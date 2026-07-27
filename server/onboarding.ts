import { z } from "zod";

import { WORK_MODES } from "./onboarding-values.js";

export { DEFAULT_FIT_WEIGHTS, WORK_MODES } from "./onboarding-values.js";

export const WorkModeSchema = z.enum(WORK_MODES);

export const EvidenceSchema = z.object({
  quote: z.string().trim().min(1),
  page: z.number().int().positive().optional(),
});

const ExperienceSchema = z.object({
  id: z.string().min(1),
  employer: z.string(),
  role: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  summary: z.string(),
  evidence: z.array(EvidenceSchema),
});

const EducationSchema = z.object({
  id: z.string().min(1),
  institution: z.string(),
  qualification: z.string(),
  field: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  evidence: z.array(EvidenceSchema),
});

const SkillSchema = z.object({
  name: z.string().trim().min(1),
  evidence: z.array(EvidenceSchema),
});

const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  summary: z.string(),
  technologies: z.array(z.string()),
  evidence: z.array(EvidenceSchema),
});

const UncertaintySchema = z.object({
  field: z.string().trim().min(1),
  description: z.string().trim().min(1),
  evidence: z.array(EvidenceSchema),
});

export const DisqualifyingConditionSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "minimum-experience",
    "employment-type",
    "outsourced-onsite",
    "closed",
    "location",
    "work-mode",
    "other",
  ]),
  description: z.string().trim().min(1),
});

export const FitWeightsSchema = z.object({
  technical: z.number().int().min(0).max(100),
  experience: z.number().int().min(0).max(100),
  careerDirection: z.number().int().min(0).max(100),
  workConditions: z.number().int().min(0).max(100),
});

export const ProfileDataSchema = z.object({
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  headline: z.string(),
  summary: z.string(),
  experience: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
  skills: z.array(SkillSchema),
  projects: z.array(ProjectSchema),
  uncertainties: z.array(UncertaintySchema),
  careerGoals: z.array(z.string()),
  preferredLocations: z.array(z.string()),
  workModes: z.array(WorkModeSchema),
  disqualifyingConditions: z.array(DisqualifyingConditionSchema),
  fitWeights: FitWeightsSchema,
});

export const ProfileDraftSchema = z.object({
  id: z.string().min(1),
  status: z.literal("draft"),
  source: z.object({
    fileName: z.string().min(1),
    blobRef: z.string().min(1),
  }),
  profile: ProfileDataSchema,
  extraction: z.object({
    model: z.string().min(1),
    promptVersion: z.string().min(1),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CandidateProfileSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  draftId: z.string().min(1),
  status: z.literal("active"),
  profile: ProfileDataSchema,
  confirmedAt: z.string().datetime(),
});

const SearchTargetFields = {
  id: z.string().min(1),
  title: z.string().trim().min(1),
  locations: z.array(z.string().trim().min(1)).min(1),
  workModes: z.array(WorkModeSchema).min(1),
};

export const SearchTargetSuggestionSchema = z.object(SearchTargetFields);
export const SearchTargetDraftSchema = z.object(SearchTargetFields);
export const SearchTargetSchema = z.object(SearchTargetFields);

export const SearchTargetDraftSetSchema = z.object({
  profileId: z.string().min(1),
  drafts: z.array(SearchTargetDraftSchema).min(3).max(5),
  updatedAt: z.string().datetime(),
});

export const SearchTargetSetSchema = z.object({
  profileId: z.string().min(1),
  searchTargets: z.array(SearchTargetSchema).min(3).max(5),
  updatedAt: z.string().datetime(),
  confirmedAt: z.string().datetime(),
});

export type ProfileData = z.infer<typeof ProfileDataSchema>;
export type ProfileDraft = z.infer<typeof ProfileDraftSchema>;
export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;
export type SearchTargetSuggestion = z.infer<typeof SearchTargetSuggestionSchema>;
export type SearchTargetDraft = z.infer<typeof SearchTargetDraftSchema>;
export type SearchTargetDraftSet = z.infer<typeof SearchTargetDraftSetSchema>;
export type SearchTarget = z.infer<typeof SearchTargetSchema>;
export type SearchTargetSet = z.infer<typeof SearchTargetSetSchema>;
export type FitWeights = z.infer<typeof FitWeightsSchema>;

export type ProfileExtractionResult = {
  profile: ProfileData;
  model: string;
  promptVersion: string;
};

export type ProfileExtraction = {
  extractProfile: (input: { bytes: Uint8Array; fileName: string; blobRef: string }) => Promise<ProfileExtractionResult>;
  suggestSearchTargets: (profile: CandidateProfile) => Promise<SearchTargetSuggestion[]>;
};

export type ResumeBlobStorage = {
  putResume: (input: { bytes: Uint8Array; fileName: string; contentType: "application/pdf" }) => Promise<string>;
};

export type OnboardingPersistence = {
  saveDraft: (draft: ProfileDraft) => Promise<void>;
  getDraft: () => Promise<ProfileDraft | null>;
  updateDraft: (draftId: string, profile: ProfileData, updatedAt: string) => Promise<ProfileDraft>;
  confirmDraft: (draftId: string, confirmedAt: string, candidateProfileId: string) => Promise<CandidateProfile>;
  saveFitWeights: (
    activeProfileId: string,
    fitWeights: FitWeights,
    confirmedAt: string,
    candidateProfileId: string,
  ) => Promise<CandidateProfile>;
  getActiveProfile: () => Promise<CandidateProfile | null>;
  saveSearchTargetDraft: (draft: SearchTargetDraftSet) => Promise<void>;
  getSearchTargetDraft: (profileId: string) => Promise<SearchTargetDraftSet | null>;
  getSearchTargets: (profileId: string) => Promise<SearchTargetSet | null>;
  confirmSearchTargets: (profileId: string, confirmedAt: string) => Promise<SearchTargetSet>;
};

export function fitWeightsTotal(weights: FitWeights): number {
  return weights.technical + weights.experience + weights.careerDirection + weights.workConditions;
}

export function isProfileDraftConfirmable(profile: ProfileData): boolean {
  const hasCareerFact =
    profile.experience.some((entry) => hasText(entry.employer, entry.role, entry.summary)) ||
    profile.education.some((entry) => hasText(entry.institution, entry.qualification, entry.field)) ||
    profile.skills.length > 0 ||
    profile.projects.some((entry) => hasText(entry.name, entry.summary, ...entry.technologies));
  const hasEvidence = [
    ...profile.experience,
    ...profile.education,
    ...profile.skills,
    ...profile.projects,
  ].some((entry) => entry.evidence.length > 0);
  const hasExplainingUncertainty = profile.uncertainties.length > 0;

  return (hasCareerFact && hasEvidence) || hasExplainingUncertainty;
}

function hasText(...values: string[]): boolean {
  return values.some((value) => value.trim().length > 0);
}
