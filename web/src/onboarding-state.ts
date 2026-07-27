import type {
  CandidateProfile,
  ProfileDraft,
  SearchTargetDraftSet,
  SearchTargetSet,
} from "../../server/onboarding.js";

export type OnboardingState = {
  draft: ProfileDraft | null;
  candidateProfile: CandidateProfile | null;
  searchTargetDraft: SearchTargetDraftSet | null;
  searchTargets: SearchTargetSet | null;
};

export function activateCandidateProfile(
  state: OnboardingState,
  candidateProfile: CandidateProfile,
): OnboardingState {
  return {
    ...state,
    draft: null,
    candidateProfile,
    searchTargetDraft: null,
    searchTargets: null,
  };
}
