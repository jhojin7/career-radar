import { z } from "zod";

import type { JobPosting, JobPostingEvidence } from "./collection.js";
import { FitWeightsSchema, fitWeightsTotal, type CandidateProfile, type FitWeights } from "./onboarding.js";

const SCORE_MIN = 0;
const SCORE_MAX = 100;

export const RecommendationStatusSchema = z.enum(["eligible", "review-required", "excluded"]);
export const RecommendationVerdictSchema = z.enum(["Strong Fit", "Good Fit", "Moderate Fit", "Low Fit"]);
export const ComponentScoresSchema = z.object({
  technical: z.number().int().min(SCORE_MIN).max(SCORE_MAX),
  experience: z.number().int().min(SCORE_MIN).max(SCORE_MAX),
  careerDirection: z.number().int().min(SCORE_MIN).max(SCORE_MAX),
  workConditions: z.number().int().min(SCORE_MIN).max(SCORE_MAX),
});

export const RecommendationInsightSchema = z.object({
  text: z.string().min(1),
  evidence: z.string().min(1).nullable(),
});

export const RecommendationConditionSchema = z.object({
  conditionId: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1),
  outcome: z.enum(["excluded", "review-required"]),
  evidence: z.string().min(1).nullable(),
});

export const JobRecommendationSchema = z.object({
  id: z.string().min(1),
  postingId: z.string().min(1),
  postingRevision: z.number().int().positive(),
  profileId: z.string().min(1),
  profileVersion: z.number().int().positive(),
  employer: z.string().min(1),
  role: z.string().min(1),
  locations: z.array(z.string()),
  workModes: z.array(z.enum(["onsite", "hybrid", "remote"])),
  closingAt: z.string().datetime().nullable(),
  status: RecommendationStatusSchema,
  componentScores: ComponentScoresSchema,
  fitScore: z.number().int().min(SCORE_MIN).max(SCORE_MAX),
  verdict: RecommendationVerdictSchema,
  strengths: z.array(RecommendationInsightSchema).min(2).max(3),
  gaps: z.array(RecommendationInsightSchema).min(2).max(3),
  disqualifyingConditions: z.array(RecommendationConditionSchema),
  evidence: z.array(z.object({
    field: z.string().min(1),
    quote: z.string().min(1),
    page: z.number().int().positive().optional(),
  })),
  originalUrl: z.string().url().optional(),
});

export type RecommendationStatus = z.infer<typeof RecommendationStatusSchema>;
export type RecommendationVerdict = z.infer<typeof RecommendationVerdictSchema>;
export type ComponentScores = z.infer<typeof ComponentScoresSchema>;
export type JobRecommendation = z.infer<typeof JobRecommendationSchema>;
export type RecommendationCondition = z.infer<typeof RecommendationConditionSchema>;

export class InvalidFitWeightsError extends Error {
  constructor(readonly total: number) {
    super(`Fit Weights must total 100; received ${total}.`);
  }
}

export function recommendJob(candidateProfile: CandidateProfile, posting: JobPosting): JobRecommendation {
  validateFitWeights(candidateProfile.profile.fitWeights);
  const componentScores = calculateComponentScores(candidateProfile, posting);
  const fitScore = calculateFitScore(componentScores, candidateProfile.profile.fitWeights);
  const conditions = evaluateDisqualifyingConditions(candidateProfile, posting);
  const status = recommendationStatus(posting, conditions);
  const insights = buildInsights(candidateProfile, posting, componentScores);

  return JobRecommendationSchema.parse({
    id: recommendationId(candidateProfile, posting),
    postingId: posting.id,
    postingRevision: posting.revision,
    profileId: candidateProfile.id,
    profileVersion: candidateProfile.version,
    employer: posting.companyName,
    role: posting.title,
    locations: posting.locations,
    workModes: posting.workModes,
    closingAt: posting.closingAt,
    status,
    componentScores,
    fitScore,
    verdict: verdictForScore(fitScore),
    strengths: insights.strengths,
    gaps: insights.gaps,
    disqualifyingConditions: conditions,
    evidence: posting.evidence,
    originalUrl: posting.source.originalUrl,
  });
}

export const createJobRecommendation = recommendJob;
export const evaluateJobPosting = recommendJob;

export function rankRecommendations(
  candidateProfile: CandidateProfile,
  postings: readonly JobPosting[],
): JobRecommendation[] {
  return postings
    .map((posting) => recommendJob(candidateProfile, posting))
    .sort(compareRecommendations);
}

export function recalculateRecommendations(
  recommendations: readonly JobRecommendation[],
  fitWeights: FitWeights,
): JobRecommendation[] {
  validateFitWeights(fitWeights);
  return recommendations
    .map((recommendation) => {
      const fitScore = calculateFitScore(recommendation.componentScores, fitWeights);
      return JobRecommendationSchema.parse({
        ...recommendation,
        fitScore,
        verdict: verdictForScore(fitScore),
      });
    })
    .sort(compareRecommendations);
}

export function compareRecommendations(left: JobRecommendation, right: JobRecommendation): number {
  const statusOrder: Record<RecommendationStatus, number> = {
    eligible: 0,
    "review-required": 1,
    excluded: 2,
  };
  return statusOrder[left.status] - statusOrder[right.status]
    || right.fitScore - left.fitScore
    || left.postingId.localeCompare(right.postingId)
    || left.postingRevision - right.postingRevision;
}

export function calculateFitScore(scores: ComponentScores, weights: FitWeights): number {
  validateFitWeights(weights);
  const weighted = scores.technical * weights.technical
    + scores.experience * weights.experience
    + scores.careerDirection * weights.careerDirection
    + scores.workConditions * weights.workConditions;
  return clampScore(Math.round(weighted / 100));
}

export function verdictForScore(score: number): RecommendationVerdict {
  const normalized = clampScore(score);
  if (normalized >= 75) return "Strong Fit";
  if (normalized >= 60) return "Good Fit";
  if (normalized >= 45) return "Moderate Fit";
  return "Low Fit";
}

export function calculateComponentScores(candidateProfile: CandidateProfile, posting: JobPosting): ComponentScores {
  return ComponentScoresSchema.parse({
    technical: technicalScore(candidateProfile, posting),
    experience: experienceScore(candidateProfile, posting),
    careerDirection: careerDirectionScore(candidateProfile, posting),
    workConditions: workConditionsScore(candidateProfile, posting),
  });
}

function validateFitWeights(weights: FitWeights): void {
  const total = fitWeightsTotal(weights);
  if (!FitWeightsSchema.safeParse(weights).success || total !== 100) throw new InvalidFitWeightsError(total);
}

function technicalScore(candidateProfile: CandidateProfile, posting: JobPosting): number {
  const candidateSkills = new Set(candidateProfile.profile.skills.map((skill) => normalize(skill.name)));
  const required = uniqueNormalized(posting.requiredSkills);
  const preferred = uniqueNormalized(posting.preferredSkills);
  if (required.length === 0 && preferred.length === 0) return 50;
  const requiredRatio = ratioMatched(required, candidateSkills);
  const preferredRatio = ratioMatched(preferred, candidateSkills);
  if (required.length === 0) return clampScore(Math.round(preferredRatio * 100));
  if (preferred.length === 0) return clampScore(Math.round(requiredRatio * 100));
  return clampScore(Math.round((requiredRatio * 0.8 + preferredRatio * 0.2) * 100));
}

function experienceScore(candidateProfile: CandidateProfile, posting: JobPosting): number {
  const required = posting.experience.minYears;
  if (required === null) return 50;
  if (required === 0) return 100;
  const candidateYears = candidateExperienceYears(candidateProfile);
  if (candidateYears === null) return 50;
  return clampScore(Math.round(Math.min(candidateYears / required, 1) * 100));
}

function careerDirectionScore(candidateProfile: CandidateProfile, posting: JobPosting): number {
  const goals = [
    candidateProfile.profile.headline,
    candidateProfile.profile.summary,
    ...candidateProfile.profile.careerGoals,
  ].filter(Boolean);
  if (goals.length === 0) return 50;
  const goalTokens = meaningfulTokens(goals.join(" "));
  const postingTokens = meaningfulTokens([posting.title, posting.summary, ...posting.responsibilities].join(" "));
  if (goalTokens.size === 0) return 50;
  const shared = [...goalTokens].filter((token) => postingTokens.has(token)).length;
  return clampScore(Math.round((shared / goalTokens.size) * 100));
}

function workConditionsScore(candidateProfile: CandidateProfile, posting: JobPosting): number {
  const dimensions: number[] = [];
  if (candidateProfile.profile.preferredLocations.length > 0) {
    dimensions.push(posting.locations.length === 0
      ? 50
      : overlaps(candidateProfile.profile.preferredLocations, posting.locations) ? 100 : 0);
  }
  if (candidateProfile.profile.workModes.length > 0) {
    dimensions.push(posting.workModes.length === 0
      ? 50
      : posting.workModes.some((mode) => candidateProfile.profile.workModes.includes(mode)) ? 100 : 0);
  }
  return dimensions.length === 0 ? 50 : clampScore(Math.round(average(dimensions)));
}

function evaluateDisqualifyingConditions(
  candidateProfile: CandidateProfile,
  posting: JobPosting,
): RecommendationCondition[] {
  return candidateProfile.profile.disqualifyingConditions.flatMap((condition): RecommendationCondition[] => {
    const result = evaluateCondition(candidateProfile, posting, condition.type, condition.description);
    if (!result) return [];
    return [{
      conditionId: condition.id,
      type: condition.type,
      description: condition.description,
      outcome: result.outcome,
      evidence: result.evidence?.quote ?? null,
    }];
  });
}

function evaluateCondition(
  candidateProfile: CandidateProfile,
  posting: JobPosting,
  type: CandidateProfile["profile"]["disqualifyingConditions"][number]["type"],
  description: string,
): { outcome: "excluded" | "review-required"; evidence?: JobPostingEvidence } | null {
  if (type === "minimum-experience") {
    const explicitLimit = experienceLimit(description);
    const candidateYears = candidateExperienceYears(candidateProfile);
    const limit = explicitLimit?.years ?? candidateYears;
    if (posting.experience.minYears === null || limit === null) return reviewResult(posting, "experience");
    const violates = explicitLimit?.inclusive
      ? posting.experience.minYears >= limit
      : posting.experience.minYears > limit;
    if (!violates) return null;
    return supportedViolation(posting, ["experience", "minyears"]);
  }

  if (type === "employment-type") {
    if (posting.employmentTypes.length === 0) return reviewResult(posting, "employmentTypes");
    const excludedTerms = employmentTerms(description);
    const violation = posting.employmentTypes.find((value) => excludedTerms.some((term) => includesTerm(value, term)));
    if (!violation) return null;
    return supportedViolation(posting, ["employment", violation]);
  }

  if (type === "outsourced-onsite") {
    const sourceText = [posting.summary, ...posting.employmentTypes, ...posting.responsibilities].join(" ");
    const outsourced = ["outsourced", "outsourcing", "dispatch", "파견", "도급", "상주"].some((term) => includesTerm(sourceText, term));
    if (!outsourced) return null;
    if (posting.workModes.length === 0) return reviewResult(posting, "workModes");
    if (!posting.workModes.includes("onsite")) return null;
    return supportedViolation(posting, ["outsourc", "dispatch", "파견", "도급", "상주", "workmode"]);
  }

  if (type === "closed") {
    const explicitClosed = [posting.summary, ...posting.evidence.map((item) => item.quote)]
      .some((value) => ["closed", "expired", "마감", "종료"].some((term) => includesTerm(value, term)));
    const closedByDate = posting.closingAt !== null && posting.closingAt <= posting.ingestedAt;
    if (!explicitClosed && !closedByDate) return null;
    return supportedViolation(posting, ["closed", "closing", "deadline", "expired", "마감", "종료"]);
  }

  if (type === "location") {
    if (candidateProfile.profile.preferredLocations.length === 0) return reviewResult(posting, "locations");
    if (posting.locations.length === 0) return reviewResult(posting, "locations");
    if (overlaps(candidateProfile.profile.preferredLocations, posting.locations)) return null;
    return supportedViolation(posting, ["location"]);
  }

  if (type === "work-mode") {
    if (candidateProfile.profile.workModes.length === 0) return reviewResult(posting, "workModes");
    if (posting.workModes.length === 0) return reviewResult(posting, "workModes");
    if (posting.workModes.some((mode) => candidateProfile.profile.workModes.includes(mode))) return null;
    return supportedViolation(posting, ["workmode", "remote", "hybrid", "onsite"]);
  }

  return { outcome: "review-required" };
}

function supportedViolation(
  posting: JobPosting,
  evidenceTerms: string[],
): { outcome: "excluded" | "review-required"; evidence?: JobPostingEvidence } {
  const evidence = findEvidence(posting, evidenceTerms);
  return evidence ? { outcome: "excluded", evidence } : { outcome: "review-required" };
}

function reviewResult(posting: JobPosting, field: string) {
  const evidence = findEvidence(posting, [field]);
  return evidence ? { outcome: "review-required" as const, evidence } : { outcome: "review-required" as const };
}

function recommendationStatus(posting: JobPosting, conditions: RecommendationCondition[]): RecommendationStatus {
  if (conditions.some((condition) => condition.outcome === "excluded")) return "excluded";
  if (posting.reviewRequired || conditions.some((condition) => condition.outcome === "review-required")) {
    return "review-required";
  }
  return "eligible";
}

function buildInsights(
  candidateProfile: CandidateProfile,
  posting: JobPosting,
  scores: ComponentScores,
): { strengths: Array<{ text: string; evidence: string | null }>; gaps: Array<{ text: string; evidence: string | null }> } {
  const candidateSkills = new Set(candidateProfile.profile.skills.map((skill) => normalize(skill.name)));
  const matched = posting.requiredSkills.filter((skill) => candidateSkills.has(normalize(skill)));
  const missing = posting.requiredSkills.filter((skill) => !candidateSkills.has(normalize(skill)));
  const factors = [
    {
      score: scores.technical,
      strength: matched.length > 0 ? `Matches required skills: ${matched.slice(0, 3).join(", ")}.` : "Technical requirements are limited or broadly aligned.",
      gap: missing.length > 0 ? `Missing evidence for required skills: ${missing.slice(0, 3).join(", ")}.` : "No additional required-skill gap was identified.",
      evidence: evidenceQuote(posting, ["requiredskills", ...matched, ...missing]),
    },
    {
      score: scores.experience,
      strength: posting.experience.minYears === null ? "No explicit minimum-experience barrier was found." : `Minimum experience is ${posting.experience.minYears} year(s).`,
      gap: posting.experience.minYears === null ? "The minimum experience requirement is uncertain." : `Candidate experience evidence was compared with a ${posting.experience.minYears}-year minimum.`,
      evidence: evidenceQuote(posting, ["experience", "minyears"]),
    },
    {
      score: scores.careerDirection,
      strength: `The ${posting.title} responsibilities align with stated career direction.`,
      gap: `Career-direction overlap for ${posting.title} is limited or uncertain.`,
      evidence: evidenceQuote(posting, ["title", "responsibilities", "summary"]),
    },
    {
      score: scores.workConditions,
      strength: "Location or work mode aligns with the Candidate Profile.",
      gap: "Location or work mode does not fully align, or evidence is missing.",
      evidence: evidenceQuote(posting, ["location", "workmode"]),
    },
  ];
  const strengths = [...factors]
    .sort((left, right) => right.score - left.score || left.strength.localeCompare(right.strength))
    .slice(0, 3)
    .map((factor) => ({ text: factor.strength, evidence: factor.evidence }));
  const gaps = [...factors]
    .sort((left, right) => left.score - right.score || left.gap.localeCompare(right.gap))
    .slice(0, 3)
    .map((factor) => ({ text: factor.gap, evidence: factor.evidence }));
  return { strengths, gaps };
}

function recommendationId(profile: CandidateProfile, posting: JobPosting): string {
  return `${profile.id}:v${profile.version}:${posting.id}:r${posting.revision}`;
}

function candidateExperienceYears(candidateProfile: CandidateProfile): number | null {
  const intervals = candidateProfile.profile.experience.flatMap((entry) => {
    const start = parseDate(entry.startDate);
    const end = parseDate(entry.endDate) ?? (isCurrentDate(entry.endDate) ? Date.parse(candidateProfile.confirmedAt) : null);
    return start !== null && end !== null && end >= start ? [{ start, end }] : [];
  }).sort((left, right) => left.start - right.start);
  if (intervals.length === 0) return null;
  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  }
  const milliseconds = merged.reduce((total, interval) => total + interval.end - interval.start, 0);
  return milliseconds / (365.25 * 24 * 60 * 60 * 1_000);
}

function isCurrentDate(value: string): boolean {
  return ["present", "current", "now", "현재", "재직중"].includes(value.trim().toLowerCase());
}

function parseDate(value: string): number | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || isCurrentDate(trimmed)) return null;
  const timestamp = Date.parse(trimmed.length === 4 && /^\d{4}$/.test(trimmed) ? `${trimmed}-01-01` : trimmed);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function employmentTerms(description: string): string[] {
  const known = ["contract", "contractor", "temporary", "dispatch", "outsourced", "계약", "파견", "도급"];
  const selected = known.filter((term) => includesTerm(description, term));
  return selected.length > 0 ? selected : known;
}

function findEvidence(posting: JobPosting, terms: string[]): JobPostingEvidence | undefined {
  return posting.evidence.find((item) => terms.some((term) => includesTerm(`${item.field} ${item.quote}`, term)));
}

function evidenceQuote(posting: JobPosting, terms: string[]): string | null {
  return findEvidence(posting, terms)?.quote ?? null;
}

function firstNumber(value: string): number | null {
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function experienceLimit(value: string): { years: number; inclusive: boolean } | null {
  const years = firstNumber(value);
  if (years === null) return null;
  const inclusive = /\d\s*\+|or more|at least|minimum|이상|최소/i.test(value);
  return { years, inclusive };
}

function meaningfulTokens(value: string): Set<string> {
  const stop = new Set(["and", "the", "for", "with", "from", "that", "this", "및", "업무", "경험"]);
  return new Set(normalize(value).split(/[^\p{L}\p{N}+#.]+/u).filter((token) => token.length >= 2 && !stop.has(token)));
}

function overlaps(left: string[], right: string[]): boolean {
  return left.some((leftValue) => right.some((rightValue) =>
    includesTerm(leftValue, rightValue) || includesTerm(rightValue, leftValue)));
}

function includesTerm(value: string, term: string): boolean {
  return searchText(value).includes(searchText(term));
}

function searchText(value: string): string {
  return normalize(value).replace(/[^\p{L}\p{N}+#.]+/gu, " ");
}

function uniqueNormalized(values: string[]): string[] {
  return [...new Set(values.map(normalize).filter(Boolean))];
}

function ratioMatched(requirements: string[], skills: Set<string>): number {
  if (requirements.length === 0) return 1;
  return requirements.filter((requirement) => skills.has(requirement)).length / requirements.length;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clampScore(score: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(score)));
}
