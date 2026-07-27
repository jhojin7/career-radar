import { describe, expect, it } from "vitest";

import type { JobPosting } from "./collection.js";
import type { CandidateProfile } from "./onboarding.js";
import {
  InvalidFitWeightsError,
  calculateFitScore,
  rankRecommendations,
  recommendJob,
  verdictForScore,
} from "./recommendation.js";

const timestamp = "2026-07-27T12:00:00.000Z";

function profile(overrides: Partial<CandidateProfile["profile"]> = {}): CandidateProfile {
  return {
    id: "profile-1",
    version: 2,
    draftId: "draft-1",
    status: "active",
    confirmedAt: timestamp,
    profile: {
      fullName: "Synthetic Candidate",
      email: "",
      phone: "",
      headline: "Platform Engineer",
      summary: "Builds TypeScript developer platforms.",
      experience: [{
        id: "experience-1",
        employer: "Synthetic Systems",
        role: "Software Engineer",
        startDate: "2020-01-01",
        endDate: "2024-01-01",
        summary: "Built platform services.",
        evidence: [{ quote: "Software Engineer, 2020–2024" }],
      }],
      education: [],
      skills: [
        { name: "TypeScript", evidence: [{ quote: "TypeScript" }] },
        { name: "GCP", evidence: [{ quote: "GCP" }] },
      ],
      projects: [],
      uncertainties: [],
      careerGoals: ["Build developer platforms"],
      preferredLocations: ["Seoul"],
      workModes: ["hybrid"],
      disqualifyingConditions: [],
      fitWeights: { technical: 40, experience: 25, careerDirection: 25, workConditions: 10 },
      ...overrides,
    },
  };
}

function posting(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: "posting-1",
    revision: 1,
    title: "Platform Engineer",
    companyName: "Synthetic Cloud",
    summary: "Build a developer platform using TypeScript.",
    employmentTypes: ["full-time"],
    locations: ["Seoul"],
    workModes: ["hybrid"],
    experience: { minYears: 3, maxYears: 5, rawText: "3–5 years" },
    requiredSkills: ["TypeScript"],
    preferredSkills: ["GCP"],
    responsibilities: ["Build developer platform services"],
    closingAt: "2026-08-31T00:00:00.000Z",
    evidence: [
      { field: "requiredSkills", quote: "TypeScript is required" },
      { field: "experience", quote: "3–5 years of experience" },
      { field: "responsibilities", quote: "Build developer platform services" },
      { field: "locations", quote: "Seoul" },
      { field: "workModes", quote: "Hybrid work" },
      { field: "employmentTypes", quote: "Full-time employment" },
    ],
    reviewRequired: false,
    source: {
      adapter: "fixture",
      identity: "posting-1",
      fileName: "posting-1.txt",
      originalUrl: "https://example.com/jobs/posting-1",
      rawSourceRef: "memory://posting-1",
    },
    contentHash: "a".repeat(64),
    processingState: "normalized",
    extraction: { model: "fake", promptVersion: "fixture-v1" },
    ingestedAt: timestamp,
    ...overrides,
  };
}

describe("deterministic recommendation Module", () => {
  it("returns a complete evidence-backed Job Recommendation with integer component scores", () => {
    const recommendation = recommendJob(profile(), posting());

    expect(recommendation).toMatchObject({
      id: "profile-1:v2:posting-1:r1",
      status: "eligible",
      employer: "Synthetic Cloud",
      role: "Platform Engineer",
      originalUrl: "https://example.com/jobs/posting-1",
    });
    expect(Object.values(recommendation.componentScores).every(Number.isInteger)).toBe(true);
    expect(Object.values(recommendation.componentScores).every((score) => score >= 0 && score <= 100)).toBe(true);
    expect(recommendation.strengths).toHaveLength(3);
    expect(recommendation.gaps).toHaveLength(3);
  });

  it("uses the rounded weighted sum for default and custom Fit Weights", () => {
    const scores = { technical: 100, experience: 80, careerDirection: 60, workConditions: 40 };
    expect(calculateFitScore(scores, { technical: 40, experience: 25, careerDirection: 25, workConditions: 10 })).toBe(79);
    expect(calculateFitScore(scores, { technical: 10, experience: 20, careerDirection: 30, workConditions: 40 })).toBe(60);
  });

  it("rejects Fit Weights whose total is not 100", () => {
    expect(() => calculateFitScore(
      { technical: 100, experience: 100, careerDirection: 100, workConditions: 100 },
      { technical: 40, experience: 25, careerDirection: 25, workConditions: 9 },
    )).toThrow(InvalidFitWeightsError);
  });

  it.each([
    [0, "Low Fit"], [44, "Low Fit"], [45, "Moderate Fit"], [59, "Moderate Fit"],
    [60, "Good Fit"], [74, "Good Fit"], [75, "Strong Fit"], [100, "Strong Fit"],
  ] as const)("maps Fit Score %i to %s", (score, verdict) => {
    expect(verdictForScore(score)).toBe(verdict);
  });

  it.each([
    {
      type: "minimum-experience" as const,
      description: "Exclude roles requiring more than 4 years",
      posting: { experience: { minYears: 5, maxYears: null, rawText: "5+ years" }, evidence: [{ field: "experience.minYears", quote: "At least 5 years" }] },
    },
    {
      type: "employment-type" as const,
      description: "Exclude contract roles",
      posting: { employmentTypes: ["contract"], evidence: [{ field: "employmentTypes", quote: "Six-month contract" }] },
    },
    {
      type: "outsourced-onsite" as const,
      description: "Exclude outsourced onsite roles",
      posting: { employmentTypes: ["dispatch"], workModes: ["onsite" as const], summary: "Client-site dispatch", evidence: [{ field: "workModes", quote: "Onsite dispatch assignment" }] },
    },
    {
      type: "closed" as const,
      description: "Exclude closed postings",
      posting: { closingAt: "2026-07-01T00:00:00.000Z", evidence: [{ field: "closingAt", quote: "Applications closed July 1" }] },
    },
    {
      type: "location" as const,
      description: "Seoul is mandatory",
      posting: { locations: ["Busan"], evidence: [{ field: "locations", quote: "Busan office only" }] },
    },
    {
      type: "work-mode" as const,
      description: "Hybrid is mandatory",
      posting: { workModes: ["onsite" as const], evidence: [{ field: "workModes", quote: "Onsite only" }] },
    },
  ])("makes a supported $type violation Excluded regardless of Fit Score", (testCase) => {
    const candidate = profile({ disqualifyingConditions: [{ id: "condition-1", type: testCase.type, description: testCase.description }] });
    const recommendation = recommendJob(candidate, posting(testCase.posting));
    expect(recommendation.status).toBe("excluded");
    expect(recommendation.disqualifyingConditions).toEqual([
      expect.objectContaining({ outcome: "excluded", evidence: expect.any(String) }),
    ]);
  });

  it("supports inclusive minimum-experience thresholds", () => {
    const candidate = profile({
      disqualifyingConditions: [{ id: "condition-1", type: "minimum-experience", description: "Exclude roles requiring 5+ years" }],
    });
    const recommendation = recommendJob(candidate, posting({
      experience: { minYears: 5, maxYears: null, rawText: "5+ years" },
      evidence: [{ field: "experience.minYears", quote: "At least 5 years" }],
    }));
    expect(recommendation.status).toBe("excluded");
  });

  it("routes a clear conflicting fact without supporting evidence to Review Required", () => {
    const candidate = profile({
      disqualifyingConditions: [{ id: "condition-1", type: "employment-type", description: "Exclude contract roles" }],
    });
    const recommendation = recommendJob(candidate, posting({ employmentTypes: ["contract"], evidence: [] }));

    expect(recommendation.status).toBe("review-required");
    expect(recommendation.disqualifyingConditions[0]).toMatchObject({ outcome: "review-required", evidence: null });
  });

  it("routes missing mandatory facts and extraction ambiguity to Review Required", () => {
    const candidate = profile({
      disqualifyingConditions: [{ id: "condition-1", type: "location", description: "Seoul is mandatory" }],
    });
    expect(recommendJob(candidate, posting({ locations: [], evidence: [] })).status).toBe("review-required");
    expect(recommendJob(profile(), posting({ reviewRequired: true })).status).toBe("review-required");
  });

  it("uses neutral component scores when both sides lack comparable facts", () => {
    const candidate = profile({ headline: "", summary: "", careerGoals: [], experience: [], skills: [], preferredLocations: [], workModes: [] });
    const recommendation = recommendJob(candidate, posting({
      requiredSkills: [], preferredSkills: [], experience: { minYears: null, maxYears: null, rawText: "" },
    }));
    expect(recommendation.componentScores).toEqual({ technical: 50, experience: 50, careerDirection: 50, workConditions: 50 });
  });

  it("produces 0 and 100 technical score edges", () => {
    expect(recommendJob(profile(), posting({ requiredSkills: ["Rust"], preferredSkills: [] })).componentScores.technical).toBe(0);
    expect(recommendJob(profile(), posting({ requiredSkills: ["TypeScript"], preferredSkills: [] })).componentScores.technical).toBe(100);
  });

  it("sorts eligible recommendations by Fit Score with a stable posting-id tie-breaker", () => {
    const candidate = profile();
    const results = rankRecommendations(candidate, [posting({ id: "posting-b" }), posting({ id: "posting-a" })]);
    expect(results.map((result) => result.postingId)).toEqual(["posting-a", "posting-b"]);
  });

  it("is repeatable for identical inputs", () => {
    const candidate = profile();
    const jobPosting = posting();
    expect(recommendJob(candidate, jobPosting)).toEqual(recommendJob(structuredClone(candidate), structuredClone(jobPosting)));
  });
});
