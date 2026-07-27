import { describe, expect, it } from "vitest";

import type { CandidateProfile, ProfileData, SearchTargetSet } from "../../server/onboarding.js";
import { activateCandidateProfile, type OnboardingState } from "./onboarding-state.js";

const profile: ProfileData = {
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
};

const newCandidateProfile: CandidateProfile = {
  id: "candidate-new",
  version: 2,
  draftId: "draft-new",
  status: "active",
  profile,
  confirmedAt: "2026-07-27T12:00:00.000Z",
};

const oldSearchTargets: SearchTargetSet = {
  profileId: "candidate-old",
  searchTargets: [
    { id: "old-1", title: "Old Platform Role", locations: ["Seoul"], workModes: ["hybrid"] },
    { id: "old-2", title: "Old Cloud Role", locations: ["Korea"], workModes: ["remote"] },
    { id: "old-3", title: "Old Infrastructure Role", locations: ["Seoul"], workModes: ["onsite"] },
  ],
  updatedAt: "2026-07-27T11:00:00.000Z",
  confirmedAt: "2026-07-27T11:00:00.000Z",
};

describe("onboarding browser state", () => {
  it("requires new Search Target suggestions after activating a new Candidate Profile", () => {
    const resumedState: OnboardingState = {
      draft: {
        id: "draft-new",
        status: "draft",
        source: { fileName: "resume.pdf", blobRef: "local://resume.pdf" },
        profile,
        extraction: { model: "fake-gemini", promptVersion: "profile-v1" },
        createdAt: "2026-07-27T11:30:00.000Z",
        updatedAt: "2026-07-27T11:30:00.000Z",
      },
      candidateProfile: { ...newCandidateProfile, id: "candidate-old", version: 1 },
      searchTargetDraft: null,
      searchTargets: oldSearchTargets,
    };

    const nextState = activateCandidateProfile(resumedState, newCandidateProfile);

    expect(nextState).toEqual({
      draft: null,
      candidateProfile: newCandidateProfile,
      searchTargetDraft: null,
      searchTargets: null,
    });
  });
});
