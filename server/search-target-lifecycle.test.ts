import { describe, expect, it } from "vitest";

import { createApp, type Logger } from "./app.js";
import type { CandidateProfile } from "./onboarding.js";

const silentLogger: Logger = { info: () => undefined };
const now = "2026-07-27T12:00:00.000Z";
const candidateProfile = {
  id: "candidate-1",
  version: 1,
  draftId: "draft-1",
  status: "active",
  profile: {},
  confirmedAt: now,
} as CandidateProfile;

describe("Search Target lifecycle", () => {
  it("keeps Gemini suggestions as an editable draft until confirmation creates Search Targets", async () => {
    let searchTargetDraft: unknown = null;
    let confirmedSearchTargets: unknown = null;
    const suggestions = [
      { id: "suggestion-1", title: "Platform Engineer", locations: ["Seoul"], workModes: ["hybrid"] },
      { id: "suggestion-2", title: "Cloud Engineer", locations: ["Korea"], workModes: ["remote"] },
      { id: "suggestion-3", title: "Infrastructure Engineer", locations: ["Seoul"], workModes: ["onsite"] },
    ];
    const persistence = {
      getDraft: async () => null,
      getActiveProfile: async () => candidateProfile,
      getSearchTargetDraft: async () => searchTargetDraft,
      getSearchTargets: async () => confirmedSearchTargets,
      saveSearchTargetDraft: async (draft: unknown) => { searchTargetDraft = draft; },
      confirmSearchTargets: async () => {
        const draft = searchTargetDraft as { profileId: string; drafts: typeof suggestions };
        confirmedSearchTargets = {
          profileId: draft.profileId,
          searchTargets: draft.drafts,
          updatedAt: now,
          confirmedAt: now,
        };
        searchTargetDraft = null;
        return confirmedSearchTargets;
      },
    };
    const app = createApp({
      logger: silentLogger,
      onboardingPersistence: persistence,
      profileExtraction: {
        extractProfile: async () => { throw new Error("Not used"); },
        suggestSearchTargets: async () => suggestions,
      },
      clock: () => new Date(now),
    } as never);

    const suggestionResponse = await app.request("/api/search-targets/suggest", { method: "POST" });
    expect(suggestionResponse.status).toBe(201);
    await expect(suggestionResponse.json()).resolves.toEqual({
      searchTargetDraft: {
        profileId: "candidate-1",
        drafts: suggestions,
        updatedAt: now,
      },
    });

    const editedDrafts = suggestions.map((suggestion, index) => ({
      ...suggestion,
      title: index === 0 ? "Senior Platform Engineer" : suggestion.title,
    }));
    const editResponse = await app.request("/api/search-targets", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: editedDrafts }),
    });
    expect(editResponse.status).toBe(200);
    await expect(editResponse.json()).resolves.toMatchObject({
      searchTargetDraft: { drafts: editedDrafts },
    });

    const confirmationResponse = await app.request("/api/search-targets/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: editedDrafts }),
    });
    expect(confirmationResponse.status).toBe(200);
    await expect(confirmationResponse.json()).resolves.toEqual({
      searchTargets: {
        profileId: "candidate-1",
        searchTargets: editedDrafts,
        updatedAt: now,
        confirmedAt: now,
      },
    });

    const resumed = await app.request("/api/onboarding/state");
    await expect(resumed.json()).resolves.toMatchObject({
      searchTargetDraft: null,
      searchTargets: { searchTargets: editedDrafts },
    });
  });
});
