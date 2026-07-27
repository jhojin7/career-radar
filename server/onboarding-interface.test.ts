import { describe, expect, it } from "vitest";

import { createApp, type Logger } from "./app.js";
import {
  type CandidateProfile,
  type OnboardingPersistence,
  type ProfileData,
  type ProfileDraft,
  type SearchTargetDraft,
  type SearchTargetDraftSet,
  type SearchTargetSet,
  type SearchTargetSuggestion,
} from "./onboarding.js";

const silentLogger: Logger = { info: () => undefined };
const now = "2026-07-27T12:00:00.000Z";

const profile: ProfileData = {
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
  fitWeights: { technical: 40, experience: 25, careerDirection: 25, workConditions: 10 },
};

function draftWith(profileData: ProfileData = profile): ProfileDraft {
  return {
    id: "draft-1",
    status: "draft",
    source: { fileName: "resume.pdf", blobRef: "local://resume.pdf" },
    profile: profileData,
    extraction: { model: "fake-gemini", promptVersion: "profile-v1" },
    createdAt: now,
    updatedAt: now,
  };
}

class FakePersistence implements OnboardingPersistence {
  draft: ProfileDraft | null;
  activeProfile: CandidateProfile | null = null;
  searchTargetDraft: SearchTargetDraftSet | null = null;
  searchTargets: SearchTargetSet | null = null;

  constructor(initialDraft: ProfileDraft | null = draftWith()) {
    this.draft = initialDraft;
  }

  async saveDraft(draft: ProfileDraft) {
    this.draft = draft;
  }

  async getDraft() {
    return this.draft;
  }

  async updateDraft(draftId: string, profileData: ProfileData, updatedAt: string) {
    if (!this.draft || this.draft.id !== draftId) {
      throw new Error("Draft is not editable");
    }
    this.draft = { ...this.draft, profile: profileData, updatedAt };
    return this.draft;
  }

  async confirmDraft(draftId: string, confirmedAt: string, candidateProfileId: string) {
    if (!this.draft || this.draft.id !== draftId) {
      throw new Error("Draft is not confirmable");
    }
    const confirmedProfile = structuredClone(this.draft.profile);
    this.activeProfile = {
      id: candidateProfileId,
      version: (this.activeProfile?.version ?? 0) + 1,
      draftId,
      status: "active",
      profile: confirmedProfile,
      confirmedAt,
    };
    this.draft = null;
    return this.activeProfile;
  }

  async getActiveProfile() {
    return this.activeProfile;
  }

  async saveSearchTargetDraft(draft: SearchTargetDraftSet) {
    this.searchTargetDraft = draft;
  }

  async getSearchTargetDraft(profileId: string) {
    return this.searchTargetDraft?.profileId === profileId ? this.searchTargetDraft : null;
  }

  async getSearchTargets(profileId: string) {
    return this.searchTargets?.profileId === profileId ? this.searchTargets : null;
  }

  async confirmSearchTargets(profileId: string, confirmedAt: string) {
    if (!this.searchTargetDraft || this.searchTargetDraft.profileId !== profileId) {
      throw new Error("Search Targets do not exist");
    }
    this.searchTargets = {
      profileId,
      searchTargets: this.searchTargetDraft.drafts,
      confirmedAt,
      updatedAt: confirmedAt,
    };
    this.searchTargetDraft = null;
    return this.searchTargets;
  }
}

function appWith(persistence: FakePersistence, suggestions: SearchTargetSuggestion[] = []) {
  return createApp({
    logger: silentLogger,
    onboardingPersistence: persistence,
    profileExtraction: {
      extractProfile: async () => ({ profile, model: "fake-gemini", promptVersion: "profile-v1" }),
      suggestSearchTargets: async () => suggestions,
    },
    idGenerator: () => "candidate-1",
    clock: () => new Date(now),
  });
}

describe("Candidate Profile onboarding HTTP interface", () => {
  it("edits all ranking inputs while the Profile Draft remains unconfirmed", async () => {
    const persistence = new FakePersistence();
    const app = appWith(persistence);
    const editedProfile: ProfileData = {
      ...profile,
      headline: "Staff platform engineer",
      careerGoals: ["Lead an internal developer platform"],
      preferredLocations: ["Seoul"],
      workModes: ["hybrid"],
      disqualifyingConditions: [
        { id: "condition-1", type: "employment-type", description: "Exclude contract roles" },
      ],
      fitWeights: { technical: 50, experience: 20, careerDirection: 20, workConditions: 10 },
    };

    const response = await app.request("/api/profile-draft/draft-1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: editedProfile }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ draft: { profile: editedProfile } });
    expect(persistence.draft?.profile).toEqual(editedProfile);
  });

  it("blocks Candidate Profile confirmation when Fit Weights do not total 100%", async () => {
    const persistence = new FakePersistence(
      draftWith({
        ...profile,
        fitWeights: { technical: 40, experience: 25, careerDirection: 25, workConditions: 5 },
      }),
    );
    const app = appWith(persistence);

    const response = await app.request("/api/profile-draft/draft-1/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: persistence.draft?.profile }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_fit_weights",
        message: "Fit Weights must total 100% before confirmation.",
        total: 95,
      },
    });
    expect(persistence.activeProfile).toBeNull();
  });

  it("blocks confirmation of a content-free Profile Draft", async () => {
    const persistence = new FakePersistence();
    const app = appWith(persistence);
    const contentFreeProfile: ProfileData = {
      ...profile,
      fullName: "",
      headline: "",
      summary: "",
      skills: [],
      uncertainties: [],
    };

    const response = await app.request("/api/profile-draft/draft-1/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: contentFreeProfile }),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "profile_draft_not_confirmable",
        message: "Add evidenced career facts or explain missing facts as uncertainties before confirmation.",
      },
    });
    expect(persistence.activeProfile).toBeNull();
  });

  it("allows confirmation when explicit uncertainties account for missing career facts", async () => {
    const persistence = new FakePersistence();
    const app = appWith(persistence);
    const uncertainProfile: ProfileData = {
      ...profile,
      headline: "",
      summary: "",
      skills: [],
      uncertainties: [
        {
          field: "career history",
          description: "The PDF text did not contain readable employment dates or role details.",
          evidence: [],
        },
      ],
    };

    const response = await app.request("/api/profile-draft/draft-1/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: uncertainProfile }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      candidateProfile: {
        profile: { uncertainties: uncertainProfile.uncertainties },
      },
    });
  });

  it("confirms an immutable active Candidate Profile version", async () => {
    const persistence = new FakePersistence();
    const app = appWith(persistence);

    const finalProfile = { ...profile, headline: "Edited before confirmation" };
    const response = await app.request("/api/profile-draft/draft-1/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: finalProfile }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      candidateProfile: {
        id: "candidate-1",
        version: 1,
        draftId: "draft-1",
        status: "active",
        profile: finalProfile,
      },
    });

    const resumed = await app.request("/api/onboarding/state");
    expect(resumed.status).toBe(200);
    await expect(resumed.json()).resolves.toMatchObject({
      draft: null,
      candidateProfile: {
        id: "candidate-1",
        profile: { headline: "Edited before confirmation" },
      },
    });
  });

  it("creates editable Search Target suggestions from the active Candidate Profile", async () => {
    const persistence = new FakePersistence();
    await persistence.confirmDraft("draft-1", now, "candidate-1");
    const suggestions: SearchTargetSuggestion[] = [
      { id: "target-1", title: "Platform Engineer", locations: ["Seoul"], workModes: ["hybrid"] },
      { id: "target-2", title: "Developer Experience Engineer", locations: ["Seoul"], workModes: ["hybrid"] },
      { id: "target-3", title: "Cloud Platform Engineer", locations: ["Seoul"], workModes: ["remote"] },
    ];
    const app = appWith(persistence, suggestions);

    const response = await app.request("/api/search-targets/suggest", { method: "POST" });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      searchTargetDraft: {
        profileId: "candidate-1",
        drafts: suggestions,
        updatedAt: now,
      },
    });
    expect(persistence.searchTargetDraft?.drafts).toEqual(suggestions);
  });

  it("adds, removes, and renames three to five scoped Search Target drafts", async () => {
    const persistence = new FakePersistence();
    await persistence.confirmDraft("draft-1", now, "candidate-1");
    const editedDrafts: SearchTargetDraft[] = [
      { id: "target-1", title: "Senior Platform Engineer", locations: ["Seoul"], workModes: ["hybrid"] },
      { id: "target-3", title: "Cloud Platform Engineer", locations: ["Korea"], workModes: ["remote"] },
      { id: "target-4", title: "Infrastructure Engineer", locations: ["Seoul"], workModes: ["onsite"] },
      { id: "target-5", title: "Developer Productivity Engineer", locations: ["Korea"], workModes: ["remote"] },
    ];
    const app = appWith(persistence);

    const response = await app.request("/api/search-targets", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: editedDrafts }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      searchTargetDraft: {
        profileId: "candidate-1",
        drafts: editedDrafts,
        updatedAt: now,
      },
    });
  });

  it("blocks out-of-range Search Target drafts and confirms a valid set", async () => {
    const persistence = new FakePersistence();
    await persistence.confirmDraft("draft-1", now, "candidate-1");
    const app = appWith(persistence);
    const tooFew: SearchTargetDraft[] = [
      { id: "target-1", title: "Platform Engineer", locations: ["Seoul"], workModes: ["hybrid"] },
      { id: "target-2", title: "Cloud Engineer", locations: ["Korea"], workModes: ["remote"] },
    ];

    const invalidResponse = await app.request("/api/search-targets", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: tooFew }),
    });
    expect(invalidResponse.status).toBe(422);

    persistence.searchTargetDraft = {
      profileId: "candidate-1",
      drafts: [
        ...tooFew,
        { id: "target-3", title: "Infrastructure Engineer", locations: ["Seoul"], workModes: ["onsite"] },
      ],
      updatedAt: now,
    };
    const finalDrafts: SearchTargetDraft[] = [
      { id: "target-1", title: "Senior Platform Engineer", locations: ["Seoul"], workModes: ["hybrid"] },
      { id: "target-2", title: "Cloud Engineer", locations: ["Korea"], workModes: ["remote"] },
      { id: "target-3", title: "Infrastructure Engineer", locations: ["Seoul"], workModes: ["onsite"] },
    ];
    const response = await app.request("/api/search-targets/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: finalDrafts }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      searchTargets: { confirmedAt: now, searchTargets: finalDrafts },
    });
  });

  it("rejects Search Target drafts without location scope", async () => {
    const persistence = new FakePersistence();
    await persistence.confirmDraft("draft-1", now, "candidate-1");
    const app = appWith(persistence);
    const response = await app.request("/api/search-targets", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        drafts: ["Platform Engineer", "Cloud Engineer", "Infrastructure Engineer"].map((title, index) => ({
          id: `target-${index + 1}`,
          title,
          locations: [],
          workModes: ["hybrid"],
        })),
      }),
    });

    expect(response.status).toBe(422);
  });

  it("returns the durable onboarding state needed to resume the workflow", async () => {
    const persistence = new FakePersistence();
    const app = appWith(persistence);

    const response = await app.request("/api/onboarding/state");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      draft: draftWith(),
      candidateProfile: null,
      searchTargetDraft: null,
      searchTargets: null,
    });
  });

  it("does not resume Search Targets from a different active Candidate Profile", async () => {
    const persistence = new FakePersistence();
    await persistence.confirmDraft("draft-1", now, "candidate-1");
    persistence.searchTargets = {
      profileId: "candidate-from-an-earlier-onboarding",
      searchTargets: [
        { id: "old-1", title: "Old Platform Role", locations: ["Seoul"], workModes: ["hybrid"] },
        { id: "old-2", title: "Old Cloud Role", locations: ["Korea"], workModes: ["remote"] },
        { id: "old-3", title: "Old Infrastructure Role", locations: ["Seoul"], workModes: ["onsite"] },
      ],
      updatedAt: now,
      confirmedAt: now,
    };
    const app = appWith(persistence);

    const response = await app.request("/api/onboarding/state");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      candidateProfile: { id: "candidate-1" },
      searchTargets: null,
    });
  });
});
