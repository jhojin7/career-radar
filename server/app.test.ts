import { describe, expect, it } from "vitest";

import { createApp, type Logger } from "./app.js";

const silentLogger: Logger = {
  info: () => undefined,
};

describe("Career Radar HTTP interface", () => {
  it("reports that the application is healthy", async () => {
    const app = createApp({ logger: silentLogger });

    const response = await app.request("/api/healthz");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("serves the browser shell through an injected web asset adapter", async () => {
    const app = createApp({
      logger: silentLogger,
      webAssets: {
        get: async (path) => {
          if (path !== "/index.html") {
            return null;
          }

          return new Response("<main>Career Radar</main>", {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        },
      },
    });

    const response = await app.request("/");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    await expect(response.text()).resolves.toBe("<main>Career Radar</main>");
  });

  it("keeps local application operations available without authentication", async () => {
    const app = createApp({ logger: silentLogger });

    const [sessionResponse, stateResponse] = await Promise.all([
      app.request("/api/session"),
      app.request("/api/onboarding/state"),
    ]);

    await expect(sessionResponse.json()).resolves.toEqual({
      authenticationRequired: false,
      authenticated: true,
    });
    expect(stateResponse.status).toBe(200);
  });

  it("protects deployed operations with a signed secure session cookie", async () => {
    const app = createApp({
      logger: silentLogger,
      auth: {
        sharedPassword: "demo-password",
        cookieSigningSecret: "01234567890123456789012345678901",
        sessionTtlSeconds: 3_600,
      },
    });

    const healthResponse = await app.request("/api/healthz");
    const anonymousResponse = await app.request("/api/onboarding/state");
    const wrongPasswordResponse = await app.request("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    const loginResponse = await app.request("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "demo-password" }),
    });
    const cookie = loginResponse.headers.get("set-cookie");
    const authenticatedResponse = await app.request("/api/onboarding/state", {
      headers: { cookie: cookie?.split(";")[0] ?? "" },
    });

    expect(healthResponse.status).toBe(200);
    expect(anonymousResponse.status).toBe(401);
    await expect(anonymousResponse.json()).resolves.toEqual({
      error: { code: "authentication_required", message: "Enter the shared password to continue." },
    });
    expect(wrongPasswordResponse.status).toBe(401);
    expect(loginResponse.status).toBe(200);
    expect(cookie).toContain("career_radar_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(authenticatedResponse.status).toBe(200);
  });

  it("clearly rejects an unsupported resume format", async () => {
    const app = createApp({ logger: silentLogger });
    const form = new FormData();
    form.set("resume", new File(["plain text"], "resume.txt", { type: "text/plain" }));

    const response = await app.request("/api/onboarding/resume", {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "unsupported_resume_format",
        message: "Upload a PDF resume to continue.",
      },
    });
  });

  it("accepts a PDF whose browser omits MIME metadata", async () => {
    const app = createApp({
      logger: silentLogger,
      blobStorage: { putResume: async () => "local://resumes/resume.pdf" },
      profileExtraction: {
        extractProfile: async () => ({
          profile: {
            fullName: "Min Kim",
            email: "",
            phone: "",
            headline: "Platform engineer",
            summary: "Builds developer platforms.",
            experience: [],
            education: [],
            skills: [{ name: "TypeScript", evidence: [{ quote: "Built TypeScript services", page: 1 }] }],
            projects: [],
            uncertainties: [],
            careerGoals: [],
            preferredLocations: [],
            workModes: [],
            disqualifyingConditions: [],
            fitWeights: { technical: 40, experience: 25, careerDirection: 25, workConditions: 10 },
          },
          model: "fake-gemini",
          promptVersion: "profile-v1",
        }),
        suggestSearchTargets: async () => [],
      },
      onboardingPersistence: { saveDraft: async () => undefined },
      idGenerator: () => "draft-without-mime",
      clock: () => new Date("2026-07-27T12:00:00.000Z"),
    } as never);
    const form = new FormData();
    form.set("resume", new File(["%PDF-1.7 synthetic"], "resume.pdf", { type: "" }));

    const response = await app.request("/api/onboarding/resume", { method: "POST", body: form });

    expect(response.status).toBe(201);
  });

  it("stores a PDF and creates a validated Profile Draft through injected adapters", async () => {
    const savedDrafts: unknown[] = [];
    const extractedProfile = {
      fullName: "Min Kim",
      email: "min@example.com",
      phone: "",
      headline: "Platform engineer",
      summary: "Builds reliable developer platforms.",
      experience: [],
      education: [],
      skills: [{ name: "TypeScript", evidence: [{ quote: "Built TypeScript services", page: 1 }] }],
      projects: [],
      uncertainties: [],
      careerGoals: [],
      preferredLocations: [],
      workModes: [],
      disqualifyingConditions: [],
      fitWeights: { technical: 1, experience: 1, careerDirection: 1, workConditions: 1 },
    };
    const app = createApp({
      logger: silentLogger,
      blobStorage: {
        putResume: async () => "local://resumes/resume.pdf",
      },
      profileExtraction: {
        extractProfile: async () => ({
          profile: extractedProfile,
          model: "fake-gemini",
          promptVersion: "profile-v1",
        }),
        suggestSearchTargets: async () => [],
      },
      onboardingPersistence: {
        saveDraft: async (draft: unknown) => {
          savedDrafts.push(draft);
        },
      },
      idGenerator: () => "draft-1",
      clock: () => new Date("2026-07-27T12:00:00.000Z"),
    } as never);
    const form = new FormData();
    form.set("resume", new File(["%PDF-1.7 synthetic"], "resume.pdf", { type: "application/pdf" }));

    const response = await app.request("/api/onboarding/resume", {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      draft: {
        id: "draft-1",
        status: "draft",
        source: {
          fileName: "resume.pdf",
          blobRef: "local://resumes/resume.pdf",
        },
        profile: {
          ...extractedProfile,
          fitWeights: { technical: 40, experience: 25, careerDirection: 25, workConditions: 10 },
        },
      },
    });
    expect(savedDrafts).toHaveLength(1);
  });

  it("rejects malformed Gemini output before it becomes a Profile Draft", async () => {
    let saved = false;
    const app = createApp({
      logger: silentLogger,
      blobStorage: { putResume: async () => "local://resumes/resume.pdf" },
      profileExtraction: {
        extractProfile: async () => ({
          profile: { headline: "Missing required structured facts" },
          model: "fake-gemini",
          promptVersion: "profile-v1",
        }),
        suggestSearchTargets: async () => [],
      },
      onboardingPersistence: { saveDraft: async () => { saved = true; } },
    } as never);
    const form = new FormData();
    form.set("resume", new File(["%PDF-1.7 synthetic"], "resume.pdf", { type: "application/pdf" }));

    const response = await app.request("/api/onboarding/resume", { method: "POST", body: form });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_profile_extraction",
        message: "Gemini could not produce a valid Profile Draft from this PDF.",
      },
    });
    expect(saved).toBe(false);
  });

  it("rejects a shape-valid extraction with no career facts, evidence, or uncertainties", async () => {
    let saved = false;
    const app = createApp({
      logger: silentLogger,
      blobStorage: { putResume: async () => "local://resumes/resume.pdf" },
      profileExtraction: {
        extractProfile: async () => ({
          profile: {
            fullName: "",
            email: "",
            phone: "",
            headline: "",
            summary: "",
            experience: [],
            education: [],
            skills: [],
            projects: [],
            uncertainties: [],
            careerGoals: [],
            preferredLocations: [],
            workModes: [],
            disqualifyingConditions: [],
            fitWeights: { technical: 40, experience: 25, careerDirection: 25, workConditions: 10 },
          },
          model: "fake-gemini",
          promptVersion: "profile-v1",
        }),
        suggestSearchTargets: async () => [],
      },
      onboardingPersistence: { saveDraft: async () => { saved = true; } },
    } as never);
    const form = new FormData();
    form.set("resume", new File(["%PDF-1.7 synthetic"], "resume.pdf", { type: "application/pdf" }));

    const response = await app.request("/api/onboarding/resume", { method: "POST", body: form });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_profile_extraction",
        message: "Gemini could not produce a valid Profile Draft from this PDF.",
      },
    });
    expect(saved).toBe(false);
  });
});
