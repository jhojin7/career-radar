import { Firestore, type DocumentData, type DocumentReference } from "@google-cloud/firestore";

import {
  CandidateProfileSchema,
  ProfileDraftSchema,
  SearchTargetDraftSetSchema,
  SearchTargetSetSchema,
  type CandidateProfile,
  type FitWeights,
  type OnboardingPersistence,
  type ProfileData,
  type ProfileDraft,
  type SearchTargetDraftSet,
  type SearchTargetSet,
} from "../onboarding.js";

type OnboardingState = {
  currentDraftId?: string | null;
  activeProfileId?: string;
  activeProfileVersion?: number;
};

export function createFirestoreOnboardingPersistence(options: { projectId?: string } = {}): OnboardingPersistence {
  const firestore = new Firestore({
    ...(options.projectId ? { projectId: options.projectId } : {}),
    ignoreUndefinedProperties: true,
  });
  const stateRef = firestore.doc("workspaceState/onboarding");
  const searchTargetDraftRef = (profileId: string) => firestore.doc(`searchTargetDrafts/${profileId}`);
  const searchTargetsRef = (profileId: string) => firestore.doc(`searchTargetSets/${profileId}`);

  return {
    async saveDraft(draft) {
      await firestore.runTransaction(async (transaction) => {
        transaction.create(firestore.doc(`profileDrafts/${draft.id}`), draft);
        transaction.set(stateRef, { currentDraftId: draft.id }, { merge: true });
      });
    },

    async getDraft() {
      const state = await stateRef.get();
      const draftId = state.data()?.currentDraftId;
      if (typeof draftId !== "string") return null;
      return readParsed(firestore.doc(`profileDrafts/${draftId}`), ProfileDraftSchema.parse);
    },

    async updateDraft(draftId, profile, updatedAt) {
      return firestore.runTransaction(async (transaction) => {
        const ref = firestore.doc(`profileDrafts/${draftId}`);
        const snapshot = await transaction.get(ref);
        const draft = snapshot.exists ? ProfileDraftSchema.parse(snapshot.data()) : null;
        if (!draft) throw new Error("Profile Draft is not editable.");
        const updated = ProfileDraftSchema.parse({ ...draft, profile, updatedAt });
        transaction.set(ref, updated);
        return updated;
      });
    },

    async confirmDraft(draftId, confirmedAt, candidateProfileId) {
      return firestore.runTransaction(async (transaction) => {
        const draftRef = firestore.doc(`profileDrafts/${draftId}`);
        const [draftSnapshot, stateSnapshot] = await Promise.all([
          transaction.get(draftRef),
          transaction.get(stateRef),
        ]);
        const draft = draftSnapshot.exists ? ProfileDraftSchema.parse(draftSnapshot.data()) : null;
        if (!draft) throw new Error("Profile Draft is not confirmable.");

        const state = (stateSnapshot.data() ?? {}) as OnboardingState;
        const candidateProfile = CandidateProfileSchema.parse({
          id: candidateProfileId,
          version: (state.activeProfileVersion ?? 0) + 1,
          draftId,
          status: "active",
          profile: structuredClone(draft.profile),
          confirmedAt,
        });
        transaction.create(firestore.doc(`candidateProfiles/${candidateProfile.id}`), candidateProfile);
        transaction.delete(draftRef);
        transaction.set(
          stateRef,
          {
            currentDraftId: null,
            activeProfileId: candidateProfile.id,
            activeProfileVersion: candidateProfile.version,
          },
          { merge: true },
        );
        return candidateProfile;
      });
    },

    async saveFitWeights(activeProfileId, fitWeights, confirmedAt, candidateProfileId) {
      return firestore.runTransaction(async (transaction) => {
        const sourceProfileRef = firestore.doc(`candidateProfiles/${activeProfileId}`);
        const sourceTargetDraftRef = searchTargetDraftRef(activeProfileId);
        const sourceTargetsRef = searchTargetsRef(activeProfileId);
        const [stateSnapshot, profileSnapshot, targetDraftSnapshot, targetsSnapshot] = await Promise.all([
          transaction.get(stateRef),
          transaction.get(sourceProfileRef),
          transaction.get(sourceTargetDraftRef),
          transaction.get(sourceTargetsRef),
        ]);
        const state = (stateSnapshot.data() ?? {}) as OnboardingState;
        const sourceProfile = profileSnapshot.exists ? CandidateProfileSchema.parse(profileSnapshot.data()) : null;
        if (!sourceProfile || state.activeProfileId !== activeProfileId) {
          throw new Error("Candidate Profile is no longer active.");
        }

        const candidateProfile = CandidateProfileSchema.parse({
          ...sourceProfile,
          id: candidateProfileId,
          version: (state.activeProfileVersion ?? sourceProfile.version) + 1,
          profile: { ...structuredClone(sourceProfile.profile), fitWeights },
          confirmedAt,
        });
        transaction.create(firestore.doc(`candidateProfiles/${candidateProfile.id}`), candidateProfile);
        transaction.set(
          stateRef,
          { activeProfileId: candidateProfile.id, activeProfileVersion: candidateProfile.version },
          { merge: true },
        );

        if (targetDraftSnapshot.exists) {
          const targetDraft = SearchTargetDraftSetSchema.parse(targetDraftSnapshot.data());
          transaction.set(searchTargetDraftRef(candidateProfile.id), { ...targetDraft, profileId: candidateProfile.id });
        }
        if (targetsSnapshot.exists) {
          const targets = SearchTargetSetSchema.parse(targetsSnapshot.data());
          transaction.set(searchTargetsRef(candidateProfile.id), { ...targets, profileId: candidateProfile.id });
        }
        return candidateProfile;
      });
    },

    async getActiveProfile() {
      const state = await stateRef.get();
      const profileId = state.data()?.activeProfileId;
      if (typeof profileId !== "string") return null;
      return readParsed(firestore.doc(`candidateProfiles/${profileId}`), CandidateProfileSchema.parse);
    },

    async saveSearchTargetDraft(draft) {
      await searchTargetDraftRef(draft.profileId).set(draft);
    },

    async getSearchTargetDraft(profileId) {
      return readParsed(searchTargetDraftRef(profileId), SearchTargetDraftSetSchema.parse);
    },

    async getSearchTargets(profileId) {
      return readParsed(searchTargetsRef(profileId), SearchTargetSetSchema.parse);
    },

    async confirmSearchTargets(profileId, confirmedAt) {
      const draftRef = searchTargetDraftRef(profileId);
      const targetSetRef = searchTargetsRef(profileId);
      return firestore.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(draftRef);
        const draft = snapshot.exists ? SearchTargetDraftSetSchema.parse(snapshot.data()) : null;
        if (!draft || draft.profileId !== profileId) {
          throw new Error("Search Targets are not confirmable.");
        }
        const confirmed = SearchTargetSetSchema.parse({
          profileId,
          searchTargets: draft.drafts,
          updatedAt: confirmedAt,
          confirmedAt,
        });
        transaction.delete(draftRef);
        transaction.set(targetSetRef, confirmed);
        return confirmed;
      });
    },
  };
}

async function readParsed<T>(
  ref: DocumentReference<DocumentData, DocumentData>,
  parse: (value: unknown) => T,
): Promise<T | null> {
  const snapshot = await ref.get();
  return snapshot.exists ? parse(snapshot.data()) : null;
}

export type { CandidateProfile, FitWeights, ProfileData, ProfileDraft, SearchTargetDraftSet, SearchTargetSet };
