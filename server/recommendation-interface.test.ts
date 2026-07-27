import { describe, expect, it } from "vitest";

import { createApp, type Logger } from "./app.js";
import type { CollectionPersistence, CollectionRun, JobPosting } from "./collection.js";
import type { CandidateProfile, FitWeights, OnboardingPersistence } from "./onboarding.js";
import type { JobRecommendation } from "./recommendation.js";

const silentLogger: Logger = { info: () => undefined };
const now = "2026-07-27T12:00:00.000Z";
const candidateProfile = {
  id: "candidate-1", version: 1, draftId: "draft-1", status: "active", confirmedAt: now,
  profile: {
    fullName: "Synthetic Candidate", email: "", phone: "", headline: "Platform Engineer", summary: "",
    experience: [], education: [], skills: [{ name: "TypeScript", evidence: [{ quote: "TypeScript" }] }],
    projects: [], uncertainties: [], careerGoals: ["Platform engineering"], preferredLocations: ["Seoul"], workModes: ["hybrid"],
    disqualifyingConditions: [{ id: "employment", type: "employment-type", description: "Exclude contract roles" }],
    fitWeights: { technical: 40, experience: 25, careerDirection: 25, workConditions: 10 },
  },
} satisfies CandidateProfile;

function posting(id: string, overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id, revision: 1, title: "Platform Engineer", companyName: `Employer ${id}`, summary: "Platform engineering",
    employmentTypes: ["full-time"], locations: ["Seoul"], workModes: ["hybrid"],
    experience: { minYears: null, maxYears: null, rawText: "" }, requiredSkills: ["TypeScript"], preferredSkills: [],
    responsibilities: ["Build platforms"], closingAt: null,
    evidence: [{ field: "requiredSkills", quote: "TypeScript" }, { field: "locations", quote: "Seoul" }],
    reviewRequired: false,
    source: { adapter: "fixture", fileName: `${id}.txt`, originalUrl: `https://example.com/${id}`, rawSourceRef: `memory://${id}` },
    contentHash: id.padEnd(64, "a").slice(0, 64), processingState: "normalized",
    extraction: { model: "fake", promptVersion: "fixture-v1" }, ingestedAt: now,
    ...overrides,
  };
}

function fixture() {
  const postings = [
    posting("eligible"),
    posting("review", { reviewRequired: true }),
    posting("excluded", { employmentTypes: ["contract"], evidence: [{ field: "employmentTypes", quote: "Contract role" }] }),
  ];
  const latestRun: CollectionRun = {
    id: "run-1", status: "completed-with-errors", profileId: candidateProfile.id, profileVersion: 1, searchTargetCount: 3,
    counts: { discovered: 4, new: 3, revised: 0, duplicate: 0, normalized: 3, reviewRequired: 1, failed: 1 },
    errors: [{ sourceKey: "broken.txt", message: "Synthetic extraction failure" }], startedAt: now, completedAt: now,
  };
  const collectionPersistence = {
    getJobPostings: async () => structuredClone(postings),
    getLatestRun: async () => structuredClone(latestRun),
  } as unknown as CollectionPersistence;
  const onboardingPersistence = {
    getActiveProfile: async () => structuredClone(candidateProfile),
  } as unknown as OnboardingPersistence;
  return createApp({ logger: silentLogger, collectionPersistence, onboardingPersistence });
}

function fitWeightFixture() {
  let activeProfile = structuredClone(candidateProfile);
  let postingReads = 0;
  let collectionStarts = 0;
  let geminiCalls = 0;
  let saves = 0;
  const postings = [
    posting("technical", { requiredSkills: ["TypeScript"], locations: ["Busan"], workModes: ["remote"] }),
    posting("conditions", { requiredSkills: ["Rust"], locations: ["Seoul"], workModes: ["hybrid"] }),
    posting("review", { reviewRequired: true }),
    posting("excluded", { employmentTypes: ["contract"], evidence: [{ field: "employmentTypes", quote: "Contract role" }] }),
  ];
  const collectionPersistence = {
    getJobPostings: async () => {
      postingReads += 1;
      return structuredClone(postings);
    },
    getLatestRun: async () => null,
  } as unknown as CollectionPersistence;
  const onboardingPersistence = {
    getActiveProfile: async () => structuredClone(activeProfile),
    saveFitWeights: async (
      activeProfileId: string,
      fitWeights: FitWeights,
      confirmedAt: string,
      candidateProfileId: string,
    ) => {
      expect(activeProfileId).toBe(activeProfile.id);
      saves += 1;
      activeProfile = {
        ...activeProfile,
        id: candidateProfileId,
        version: activeProfile.version + 1,
        profile: { ...activeProfile.profile, fitWeights },
        confirmedAt,
      };
      return structuredClone(activeProfile);
    },
  } as unknown as OnboardingPersistence;
  const app = createApp({
    logger: silentLogger,
    collectionPersistence,
    onboardingPersistence,
    collectionRunLauncher: {
      start: async () => {
        collectionStarts += 1;
        throw new Error("Collection must not start during Fit Weight preview.");
      },
    },
    profileExtraction: {
      extractProfile: async () => {
        geminiCalls += 1;
        throw new Error("Gemini must not run during Fit Weight preview.");
      },
      suggestSearchTargets: async () => {
        geminiCalls += 1;
        throw new Error("Gemini must not run during Fit Weight preview.");
      },
    },
    idGenerator: () => "candidate-2",
    clock: () => new Date("2026-07-27T13:00:00.000Z"),
  });
  return {
    app,
    calls: () => ({ postingReads, collectionStarts, geminiCalls, saves }),
    activeProfile: () => structuredClone(activeProfile),
  };
}

describe("Job Recommendation Hono interface", () => {
  it.each([
    ["eligible", "eligible"],
    ["review-required", "review-required"],
    ["excluded", "excluded"],
  ] as const)("returns the %s view with complete recommendation cards", async (view, expectedStatus) => {
    const response = await fixture().request(`/api/recommendations?view=${view}`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      view,
      counts: { eligible: 1, reviewRequired: 1, excluded: 1, failed: 1 },
      recommendations: [{ status: expectedStatus, employer: expect.any(String), role: "Platform Engineer", fitScore: expect.any(Number) }],
    });
  });

  it("returns failed Job Postings as a separate view", async () => {
    const response = await fixture().request("/api/recommendations?view=failed");
    await expect(response.json()).resolves.toMatchObject({
      recommendations: [],
      failedPostings: [{ sourceKey: "broken.txt", message: "Synthetic extraction failure" }],
    });
  });

  it("returns recommendation detail with scores, explanations, evidence, and original URL", async () => {
    const listResponse = await fixture().request("/api/recommendations");
    const list = await listResponse.json() as { recommendations: Array<{ id: string }> };
    const response = await fixture().request(`/api/recommendations/${encodeURIComponent(list.recommendations[0]!.id)}`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recommendation).toMatchObject({
      componentScores: { technical: expect.any(Number), experience: expect.any(Number), careerDirection: expect.any(Number), workConditions: expect.any(Number) },
      strengths: expect.arrayContaining([{ text: expect.any(String), evidence: expect.anything() }]),
      gaps: expect.any(Array),
      originalUrl: "https://example.com/eligible",
    });
    expect(body.recommendation.strengths).toHaveLength(3);
    expect(body.recommendation.gaps).toHaveLength(3);
  });

  it("returns a stable not-found response", async () => {
    const response = await fixture().request("/api/recommendations/not-found");
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "recommendation_not_found", message: "Job Recommendation not found." },
    });
  });

  it("previews Fit Score, verdict, and order changes from stable component scores without collection or Gemini", async () => {
    const test = fitWeightFixture();
    const baselineResponse = await test.app.request("/api/recommendations?view=eligible");
    const baseline = await baselineResponse.json() as { recommendations: JobRecommendation[] };

    const previewResponse = await test.app.request("/api/recommendations/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        view: "eligible",
        fitWeights: { technical: 0, experience: 0, careerDirection: 0, workConditions: 100 },
      }),
    });
    const preview = await previewResponse.json() as { recommendations: JobRecommendation[] };

    expect(previewResponse.status).toBe(200);
    expect(baseline.recommendations.map((recommendation) => recommendation.postingId).slice(0, 2)).toEqual(["technical", "conditions"]);
    expect(preview.recommendations.map((recommendation) => recommendation.postingId).slice(0, 2)).toEqual(["conditions", "technical"]);
    const baselineScores = Object.fromEntries(baseline.recommendations.map((recommendation) => [recommendation.postingId, recommendation.componentScores]));
    expect(preview.recommendations.every((recommendation) =>
      JSON.stringify(recommendation.componentScores) === JSON.stringify(baselineScores[recommendation.postingId]))).toBe(true);
    expect(preview.recommendations[0]).toMatchObject({ fitScore: 100, verdict: "Strong Fit" });
    expect(test.calls()).toEqual({ postingReads: 2, collectionStarts: 0, geminiCalls: 0, saves: 0 });
  });

  it("rejects invalid preview and save totals without creating a Candidate Profile version", async () => {
    const test = fitWeightFixture();
    const request = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fitWeights: { technical: 40, experience: 25, careerDirection: 25, workConditions: 9 } }),
    };

    for (const path of ["/api/recommendations/preview", "/api/candidate-profile/fit-weights"]) {
      const response = await test.app.request(path, request);
      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "invalid_fit_weights", total: 99 },
      });
    }
    expect(test.calls().saves).toBe(0);
    expect(test.activeProfile()).toEqual(candidateProfile);
  });

  it.each([
    { technical: -1, experience: 26, careerDirection: 25, workConditions: 50 },
    { technical: 39.5, experience: 25.5, careerDirection: 25, workConditions: 10 },
  ])("rejects non-integer or negative Fit Weights even when they total 100%", async (fitWeights) => {
    const test = fitWeightFixture();
    const response = await test.app.request("/api/candidate-profile/fit-weights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fitWeights }),
    });

    expect(response.status).toBe(422);
    expect(test.calls().saves).toBe(0);
  });

  it("restores the default 40/25/25/10 preview in one request", async () => {
    const test = fitWeightFixture();
    const response = await test.app.request("/api/recommendations/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fitWeights: { technical: 40, experience: 25, careerDirection: 25, workConditions: 10 } }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      fitWeights: { technical: 40, experience: 25, careerDirection: 25, workConditions: 10 },
      profileVersion: 1,
    });
  });

  it("saves valid Fit Weights as a new active Candidate Profile version", async () => {
    const test = fitWeightFixture();
    const fitWeights = { technical: 10, experience: 20, careerDirection: 30, workConditions: 40 };
    const response = await test.app.request("/api/candidate-profile/fit-weights", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fitWeights }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      candidateProfile: {
        id: "candidate-2",
        version: 2,
        confirmedAt: "2026-07-27T13:00:00.000Z",
        profile: {
          fitWeights,
          disqualifyingConditions: candidateProfile.profile.disqualifyingConditions,
        },
      },
    });
    expect(test.calls().saves).toBe(1);
    expect(test.activeProfile().profile.skills).toEqual(candidateProfile.profile.skills);
  });

  it("keeps Disqualifying Conditions and Review Required unchanged in previews", async () => {
    const test = fitWeightFixture();
    const response = await test.app.request("/api/recommendations/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        view: "excluded",
        fitWeights: { technical: 0, experience: 0, careerDirection: 0, workConditions: 100 },
      }),
    });
    const excluded = await response.json() as { counts: { reviewRequired: number; excluded: number }; recommendations: JobRecommendation[] };

    expect(excluded.counts).toMatchObject({ reviewRequired: 1, excluded: 1 });
    expect(excluded.recommendations).toEqual([
      expect.objectContaining({ postingId: "excluded", status: "excluded", disqualifyingConditions: expect.any(Array) }),
    ]);
  });
});
