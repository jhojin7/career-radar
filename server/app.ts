import { createHash, timingSafeEqual } from "node:crypto";

import { Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { z } from "zod";

import {
  CollectionAlreadyActiveError,
  CollectionPreconditionError,
  JobPoolSummarySchema,
  queueCollectionRun,
  type CollectionPersistence,
} from "./collection.js";
import { failQueuedRun, type CollectionRunLauncher } from "./collection-run-launcher.js";
import {
  CandidateProfileSchema,
  DEFAULT_FIT_WEIGHTS,
  FitWeightsSchema,
  ProfileDataSchema,
  ProfileDraftSchema,
  SearchTargetDraftSetSchema,
  SearchTargetSetSchema,
  fitWeightsTotal,
  isProfileDraftConfirmable,
  type OnboardingPersistence,
  type ProfileExtraction,
  type ResumeBlobStorage,
} from "./onboarding.js";
import {
  InvalidFitWeightsError,
  RecommendationStatusSchema,
  rankRecommendations,
  recalculateRecommendations,
} from "./recommendation.js";

const HealthResponse = z.object({
  status: z.literal("ok"),
});
const SESSION_COOKIE = "career_radar_session";
const SessionCredentialsSchema = z.object({ password: z.string() });

export type SessionAuth = {
  sharedPassword: string;
  cookieSigningSecret: string;
  sessionTtlSeconds: number;
};

export type Logger = {
  info: (event: {
    method: string;
    path: string;
    status: number;
    durationMs: number;
  }) => void;
};

export type AppDependencies = {
  logger: Logger;
  auth?: SessionAuth;
  webAssets?: WebAssets;
  blobStorage?: ResumeBlobStorage;
  profileExtraction?: ProfileExtraction;
  onboardingPersistence?: OnboardingPersistence;
  collectionPersistence?: CollectionPersistence;
  collectionRunLauncher?: CollectionRunLauncher;
  idGenerator?: () => string;
  clock?: () => Date;
};

export type WebAssets = {
  get: (path: string) => Promise<Response | null>;
};

export function createApp({
  logger,
  auth,
  webAssets,
  blobStorage,
  profileExtraction,
  onboardingPersistence,
  collectionPersistence,
  collectionRunLauncher,
  idGenerator = () => crypto.randomUUID(),
  clock = () => new Date(),
}: AppDependencies): Hono {
  const app = new Hono();

  app.use("*", async (context, next) => {
    const startedAt = performance.now();

    await next();

    logger.info({
      method: context.req.method,
      path: context.req.path,
      status: context.res.status,
      durationMs: Math.round(performance.now() - startedAt),
    });
  });

  app.get("/api/healthz", (context) => {
    return context.json(HealthResponse.parse({ status: "ok" }));
  });

  app.get("/api/session", async (context) => {
    return context.json({
      authenticationRequired: Boolean(auth),
      authenticated: auth ? await hasValidSession(context, auth, clock) : true,
    });
  });

  app.post("/api/session", async (context) => {
    if (!auth) {
      return context.json({ authenticationRequired: false, authenticated: true });
    }
    const credentials = SessionCredentialsSchema.safeParse(await context.req.json().catch(() => null));
    if (!credentials.success || !passwordsMatch(credentials.data.password, auth.sharedPassword)) {
      return context.json(
        { error: { code: "invalid_credentials", message: "The shared password is incorrect." } },
        401,
      );
    }

    const expiresAt = Math.floor(clock().getTime() / 1_000) + auth.sessionTtlSeconds;
    await setSignedCookie(context, SESSION_COOKIE, String(expiresAt), auth.cookieSigningSecret, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      path: "/",
      maxAge: auth.sessionTtlSeconds,
    });
    return context.json({ authenticationRequired: true, authenticated: true });
  });

  app.delete("/api/session", (context) => {
    deleteCookie(context, SESSION_COOKIE, { path: "/", secure: true });
    return context.body(null, 204);
  });

  app.use("/api/*", async (context, next) => {
    if (!auth || await hasValidSession(context, auth, clock)) {
      await next();
      return;
    }
    return context.json(
      { error: { code: "authentication_required", message: "Enter the shared password to continue." } },
      401,
    );
  });

  app.get("/api/onboarding/state", async (context) => {
    if (!onboardingPersistence) {
      return context.json({ draft: null, candidateProfile: null, searchTargetDraft: null, searchTargets: null });
    }

    const [draft, candidateProfile] = await Promise.all([
      onboardingPersistence.getDraft(),
      onboardingPersistence.getActiveProfile(),
    ]);
    const [searchTargetDraft, searchTargets] = candidateProfile
      ? await Promise.all([
          onboardingPersistence.getSearchTargetDraft(candidateProfile.id),
          onboardingPersistence.getSearchTargets(candidateProfile.id),
        ])
      : [null, null];
    return context.json({ draft, candidateProfile, searchTargetDraft, searchTargets });
  });

  app.post("/api/onboarding/resume", async (context) => {
    const body = await context.req.parseBody();
    const resume = body.resume;

    const hasPdfExtension = resume instanceof File && resume.name.toLowerCase().endsWith(".pdf");
    const hasSupportedMimeType = resume instanceof File &&
      (resume.type === "" || resume.type === "application/pdf" || resume.type === "application/octet-stream");
    if (!(resume instanceof File) || !hasPdfExtension || !hasSupportedMimeType) {
      return context.json(
        {
          error: {
            code: "unsupported_resume_format",
            message: "Upload a PDF resume to continue.",
          },
        },
        415,
      );
    }

    if (!blobStorage || !profileExtraction || !onboardingPersistence) {
      return context.json(
        { error: { code: "onboarding_unavailable", message: "Resume onboarding is not configured." } },
        503,
      );
    }

    if (resume.size > 15 * 1024 * 1024) {
      return context.json(
        { error: { code: "resume_too_large", message: "Choose a PDF resume no larger than 15 MB." } },
        413,
      );
    }

    const bytes = new Uint8Array(await resume.arrayBuffer());
    if (bytes.length === 0 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      return context.json(
        { error: { code: "invalid_pdf", message: "The selected file is not a valid PDF." } },
        422,
      );
    }

    const blobRef = await blobStorage.putResume({ bytes, fileName: resume.name, contentType: "application/pdf" });
    const extraction = await profileExtraction.extractProfile({ bytes, fileName: resume.name, blobRef });
    const parsedProfile = ProfileDataSchema.safeParse(extraction.profile);
    if (!parsedProfile.success || !isProfileDraftConfirmable(parsedProfile.data)) {
      return context.json(
        {
          error: {
            code: "invalid_profile_extraction",
            message: "Gemini could not produce a valid Profile Draft from this PDF.",
          },
        },
        502,
      );
    }
    const now = clock().toISOString();
    const draft = ProfileDraftSchema.parse({
      id: idGenerator(),
      status: "draft",
      source: { fileName: resume.name, blobRef },
      profile: { ...parsedProfile.data, fitWeights: { ...DEFAULT_FIT_WEIGHTS } },
      extraction: {
        model: extraction.model,
        promptVersion: extraction.promptVersion,
      },
      createdAt: now,
      updatedAt: now,
    });

    await onboardingPersistence.saveDraft(draft);

    return context.json({ draft }, 201);
  });

  app.put("/api/profile-draft/:draftId", async (context) => {
    if (!onboardingPersistence) {
      return context.json(
        { error: { code: "onboarding_unavailable", message: "Resume onboarding is not configured." } },
        503,
      );
    }

    const body = await context.req.json().catch(() => null);
    const parsed = z.object({ profile: ProfileDataSchema }).safeParse(body);
    if (!parsed.success) {
      return context.json(
        { error: { code: "invalid_profile_draft", message: "Review the highlighted Profile Draft fields." } },
        422,
      );
    }

    const draft = await onboardingPersistence.updateDraft(
      context.req.param("draftId"),
      parsed.data.profile,
      clock().toISOString(),
    );

    return context.json({ draft });
  });

  app.post("/api/profile-draft/:draftId/confirm", async (context) => {
    if (!onboardingPersistence) {
      return context.json(
        { error: { code: "onboarding_unavailable", message: "Resume onboarding is not configured." } },
        503,
      );
    }

    const draft = await onboardingPersistence.getDraft();
    if (!draft || draft.id !== context.req.param("draftId")) {
      return context.json({ error: { code: "profile_draft_not_found", message: "Profile Draft not found." } }, 404);
    }

    const body = await context.req.json().catch(() => null);
    const parsed = z.object({ profile: ProfileDataSchema }).safeParse(body);
    if (!parsed.success) {
      return context.json(
        { error: { code: "invalid_profile_draft", message: "Review the highlighted Profile Draft fields." } },
        422,
      );
    }

    if (!isProfileDraftConfirmable(parsed.data.profile)) {
      return context.json(
        {
          error: {
            code: "profile_draft_not_confirmable",
            message: "Add evidenced career facts or explain missing facts as uncertainties before confirmation.",
          },
        },
        422,
      );
    }

    const total = fitWeightsTotal(parsed.data.profile.fitWeights);
    if (total !== 100) {
      return context.json(
        {
          error: {
            code: "invalid_fit_weights",
            message: "Fit Weights must total 100% before confirmation.",
            total,
          },
        },
        422,
      );
    }

    const confirmedAt = clock().toISOString();
    await onboardingPersistence.updateDraft(draft.id, parsed.data.profile, confirmedAt);
    const candidateProfile = CandidateProfileSchema.parse(
      await onboardingPersistence.confirmDraft(draft.id, confirmedAt, idGenerator()),
    );

    return context.json({ candidateProfile }, 201);
  });

  app.post("/api/search-targets/suggest", async (context) => {
    if (!onboardingPersistence || !profileExtraction) {
      return context.json(
        { error: { code: "onboarding_unavailable", message: "Resume onboarding is not configured." } },
        503,
      );
    }

    const activeProfile = await onboardingPersistence.getActiveProfile();
    if (!activeProfile) {
      return context.json(
        { error: { code: "active_profile_required", message: "Confirm a Candidate Profile before suggesting Search Targets." } },
        409,
      );
    }

    const searchTargetDraft = SearchTargetDraftSetSchema.parse({
      profileId: activeProfile.id,
      drafts: await profileExtraction.suggestSearchTargets(activeProfile),
      updatedAt: clock().toISOString(),
    });
    await onboardingPersistence.saveSearchTargetDraft(searchTargetDraft);

    return context.json({ searchTargetDraft }, 201);
  });

  app.put("/api/search-targets", async (context) => {
    if (!onboardingPersistence) {
      return context.json(
        { error: { code: "onboarding_unavailable", message: "Resume onboarding is not configured." } },
        503,
      );
    }

    const activeProfile = await onboardingPersistence.getActiveProfile();
    if (!activeProfile) {
      return context.json(
        { error: { code: "active_profile_required", message: "Confirm a Candidate Profile before editing Search Targets." } },
        409,
      );
    }

    const body = await context.req.json().catch(() => null);
    const parsed = SearchTargetDraftSetSchema.safeParse({
      profileId: activeProfile.id,
      drafts: body && typeof body === "object" && "drafts" in body ? body.drafts : undefined,
      updatedAt: clock().toISOString(),
    });
    if (!parsed.success) {
      return context.json(
        {
          error: {
            code: "invalid_search_targets",
            message: "Confirm three to five Search Targets with a title, location scope, and work mode.",
          },
        },
        422,
      );
    }

    await onboardingPersistence.saveSearchTargetDraft(parsed.data);
    return context.json({ searchTargetDraft: parsed.data });
  });

  app.post("/api/search-targets/confirm", async (context) => {
    if (!onboardingPersistence) {
      return context.json(
        { error: { code: "onboarding_unavailable", message: "Resume onboarding is not configured." } },
        503,
      );
    }

    const activeProfile = await onboardingPersistence.getActiveProfile();
    if (!activeProfile) {
      return context.json(
        { error: { code: "active_profile_required", message: "Confirm a Candidate Profile before confirming Search Targets." } },
        409,
      );
    }

    const body = await context.req.json().catch(() => null);
    const confirmedAt = clock().toISOString();
    const parsed = SearchTargetDraftSetSchema.safeParse({
      profileId: activeProfile.id,
      drafts: body && typeof body === "object" && "drafts" in body ? body.drafts : undefined,
      updatedAt: confirmedAt,
    });
    if (!parsed.success) {
      return context.json(
        {
          error: {
            code: "invalid_search_targets",
            message: "Confirm three to five Search Targets with a title, location scope, and work mode.",
          },
        },
        422,
      );
    }

    await onboardingPersistence.saveSearchTargetDraft(parsed.data);
    const searchTargets = SearchTargetSetSchema.parse(
      await onboardingPersistence.confirmSearchTargets(activeProfile.id, confirmedAt),
    );
    return context.json({ searchTargets });
  });

  app.get("/api/collection/state", async (context) => {
    if (!collectionPersistence) {
      return context.json({
        latestRun: null,
        jobPoolSummary: JobPoolSummarySchema.parse({
          activePostings: 0,
          reviewRequired: 0,
          totalRevisions: 0,
          lastUpdatedAt: null,
        }),
      });
    }
    const [latestRun, jobPoolSummary] = await Promise.all([
      collectionPersistence.getLatestRun(),
      collectionPersistence.getJobPoolSummary(),
    ]);
    return context.json({ latestRun, jobPoolSummary });
  });

  app.get("/api/recommendations", async (context) => {
    if (!collectionPersistence || !onboardingPersistence) {
      return context.json(
        { error: { code: "recommendations_unavailable", message: "Job Recommendations are not configured." } },
        503,
      );
    }
    const requestedView = context.req.query("view") ?? context.req.query("status") ?? "eligible";
    const view = z.enum(["eligible", "review-required", "excluded", "failed"]).safeParse(requestedView);
    if (!view.success) {
      return context.json(
        { error: { code: "invalid_recommendation_view", message: "Choose eligible, review-required, excluded, or failed." } },
        422,
      );
    }
    const candidateProfile = await onboardingPersistence.getActiveProfile();
    if (!candidateProfile) {
      return context.json(
        { error: { code: "active_profile_required", message: "Confirm a Candidate Profile before viewing Job Recommendations." } },
        409,
      );
    }

    try {
      const [postings, latestRun] = await Promise.all([
        collectionPersistence.getJobPostings(),
        collectionPersistence.getLatestRun(),
      ]);
      const all = rankRecommendations(candidateProfile, postings);
      const counts = {
        eligible: all.filter((recommendation) => recommendation.status === "eligible").length,
        reviewRequired: all.filter((recommendation) => recommendation.status === "review-required").length,
        excluded: all.filter((recommendation) => recommendation.status === "excluded").length,
        failed: latestRun?.errors.length ?? 0,
      };
      const recommendations = view.data === "failed"
        ? []
        : all.filter((recommendation) => recommendation.status === RecommendationStatusSchema.parse(view.data));
      return context.json({
        view: view.data,
        fitWeights: candidateProfile.profile.fitWeights,
        profileVersion: candidateProfile.version,
        counts,
        recommendations,
        failedPostings: view.data === "failed" ? latestRun?.errors ?? [] : [],
      });
    } catch (error) {
      if (error instanceof InvalidFitWeightsError) {
        return context.json(
          { error: { code: "invalid_fit_weights", message: error.message, total: error.total } },
          422,
        );
      }
      throw error;
    }
  });

  app.post("/api/recommendations/preview", async (context) => {
    if (!collectionPersistence || !onboardingPersistence) {
      return context.json(
        { error: { code: "recommendations_unavailable", message: "Job Recommendations are not configured." } },
        503,
      );
    }
    const body = await context.req.json().catch(() => null);
    const parsed = z.object({
      fitWeights: FitWeightsSchema,
      view: z.enum(["eligible", "review-required", "excluded", "failed"]).default("eligible"),
    }).safeParse(body);
    const total = fitWeightsTotalFromRequest(body);
    if (!parsed.success || total !== 100) {
      return context.json(
        {
          error: {
            code: "invalid_fit_weights",
            message: "Fit Weights must be non-negative whole percentages totaling 100%.",
            total,
          },
        },
        422,
      );
    }
    const candidateProfile = await onboardingPersistence.getActiveProfile();
    if (!candidateProfile) {
      return context.json(
        { error: { code: "active_profile_required", message: "Confirm a Candidate Profile before previewing Fit Weights." } },
        409,
      );
    }

    const [postings, latestRun] = await Promise.all([
      collectionPersistence.getJobPostings(),
      collectionPersistence.getLatestRun(),
    ]);
    const currentRecommendations = rankRecommendations(candidateProfile, postings);
    const all = recalculateRecommendations(currentRecommendations, parsed.data.fitWeights);
    const counts = {
      eligible: all.filter((recommendation) => recommendation.status === "eligible").length,
      reviewRequired: all.filter((recommendation) => recommendation.status === "review-required").length,
      excluded: all.filter((recommendation) => recommendation.status === "excluded").length,
      failed: latestRun?.errors.length ?? 0,
    };
    const recommendations = parsed.data.view === "failed"
      ? []
      : all.filter((recommendation) => recommendation.status === RecommendationStatusSchema.parse(parsed.data.view));
    return context.json({
      view: parsed.data.view,
      fitWeights: parsed.data.fitWeights,
      profileVersion: candidateProfile.version,
      counts,
      recommendations,
      failedPostings: parsed.data.view === "failed" ? latestRun?.errors ?? [] : [],
    });
  });

  app.post("/api/candidate-profile/fit-weights", async (context) => {
    if (!onboardingPersistence) {
      return context.json(
        { error: { code: "onboarding_unavailable", message: "Candidate Profile persistence is not configured." } },
        503,
      );
    }
    const body = await context.req.json().catch(() => null);
    const parsed = z.object({ fitWeights: FitWeightsSchema }).safeParse(body);
    const total = fitWeightsTotalFromRequest(body);
    if (!parsed.success || total !== 100) {
      return context.json(
        {
          error: {
            code: "invalid_fit_weights",
            message: "Fit Weights must be non-negative whole percentages totaling 100%.",
            total,
          },
        },
        422,
      );
    }
    const activeProfile = await onboardingPersistence.getActiveProfile();
    if (!activeProfile) {
      return context.json(
        { error: { code: "active_profile_required", message: "Confirm a Candidate Profile before saving Fit Weights." } },
        409,
      );
    }
    const candidateProfile = CandidateProfileSchema.parse(await onboardingPersistence.saveFitWeights(
      activeProfile.id,
      parsed.data.fitWeights,
      clock().toISOString(),
      idGenerator(),
    ));
    return context.json({ candidateProfile }, 201);
  });

  app.get("/api/recommendations/:recommendationId", async (context) => {
    if (!collectionPersistence || !onboardingPersistence) {
      return context.json(
        { error: { code: "recommendations_unavailable", message: "Job Recommendations are not configured." } },
        503,
      );
    }
    const candidateProfile = await onboardingPersistence.getActiveProfile();
    if (!candidateProfile) {
      return context.json(
        { error: { code: "active_profile_required", message: "Confirm a Candidate Profile before viewing Job Recommendations." } },
        409,
      );
    }
    let recommendations;
    try {
      recommendations = rankRecommendations(candidateProfile, await collectionPersistence.getJobPostings());
    } catch (error) {
      if (error instanceof InvalidFitWeightsError) {
        return context.json(
          { error: { code: "invalid_fit_weights", message: error.message, total: error.total } },
          422,
        );
      }
      throw error;
    }
    const recommendation = recommendations.find((item) => item.id === context.req.param("recommendationId"));
    if (!recommendation) {
      return context.json(
        { error: { code: "recommendation_not_found", message: "Job Recommendation not found." } },
        404,
      );
    }
    return context.json({ recommendation });
  });

  app.post("/api/collection-runs", async (context) => {
    if (!collectionRunLauncher || !collectionPersistence || !onboardingPersistence) {
      return context.json(
        { error: { code: "collection_unavailable", message: "Job Pool collection is not configured." } },
        503,
      );
    }
    try {
      const collectionRun = await queueCollectionRun({
        persistence: collectionPersistence,
        onboardingPersistence,
        idGenerator,
        clock,
      });
      try {
        await collectionRunLauncher.start({ runId: collectionRun.id });
      } catch (error) {
        await failQueuedRun(collectionPersistence, collectionRun.id, errorMessage(error), clock);
        return context.json(
          { error: { code: "collection_launch_failed", message: "The Collection Run could not be started." } },
          502,
        );
      }
      return context.json({ collectionRun }, 202);
    } catch (error) {
      if (error instanceof CollectionPreconditionError) {
        return context.json(
          { error: { code: "collection_precondition_failed", message: error.message } },
          409,
        );
      }
      if (error instanceof CollectionAlreadyActiveError) {
        return context.json(
          { error: { code: "collection_run_active", message: error.message } },
          409,
        );
      }
      throw error;
    }
  });

  if (webAssets) {
    app.get("*", async (context) => {
      if (context.req.path.startsWith("/api/")) {
        return context.notFound();
      }

      const requestedPath = context.req.path === "/" ? "/index.html" : context.req.path;
      const asset = await webAssets.get(requestedPath);

      if (asset) {
        return asset;
      }

      if (requestedPath.includes(".")) {
        return context.notFound();
      }

      return (await webAssets.get("/index.html")) ?? context.notFound();
    });
  }

  return app;
}

function fitWeightsTotalFromRequest(body: unknown): number | null {
  if (!body || typeof body !== "object" || !("fitWeights" in body)) return null;
  const fitWeights = body.fitWeights;
  if (!fitWeights || typeof fitWeights !== "object") return null;
  const values = ["technical", "experience", "careerDirection", "workConditions"]
    .map((key) => key in fitWeights ? fitWeights[key as keyof typeof fitWeights] : undefined);
  return values.every((value) => typeof value === "number")
    ? values.reduce<number>((total, value) => total + (value as number), 0)
    : null;
}

async function hasValidSession(
  context: Parameters<typeof getSignedCookie>[0],
  auth: SessionAuth,
  clock: () => Date,
): Promise<boolean> {
  const expiresAt = Number(await getSignedCookie(context, auth.cookieSigningSecret, SESSION_COOKIE));
  return Number.isSafeInteger(expiresAt) && expiresAt > Math.floor(clock().getTime() / 1_000);
}

function passwordsMatch(received: string, expected: string): boolean {
  const receivedDigest = createHash("sha256").update(received).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(receivedDigest, expectedDigest);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
