import { describe, expect, it } from "vitest";

import { createApp, type Logger } from "./app.js";
import type { CollectionPersistence, CollectionRun, JobPosting } from "./collection.js";
import type { CandidateProfile, OnboardingPersistence } from "./onboarding.js";

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
});
