import { createHash } from "node:crypto";

import { Firestore } from "@google-cloud/firestore";

import {
  CollectionRunSchema,
  JobPoolSummarySchema,
  JobPostingSchema,
  type CollectionPersistence,
  type JobPosting,
  type PostingLookup,
} from "../collection.js";

export function createFirestoreCollectionPersistence(options: { projectId?: string } = {}): CollectionPersistence {
  const firestore = new Firestore({
    ...(options.projectId ? { projectId: options.projectId } : {}),
    ignoreUndefinedProperties: true,
  });

  return {
    async createRun(run) {
      await firestore.doc(`collectionRuns/${run.id}`).create(run);
    },

    async updateRun(run) {
      await firestore.doc(`collectionRuns/${run.id}`).set(run);
    },

    async getLatestRun() {
      const snapshot = await firestore.collection("collectionRuns").orderBy("startedAt", "desc").limit(1).get();
      return snapshot.empty ? null : CollectionRunSchema.parse(snapshot.docs[0]?.data());
    },

    async getJobPoolSummary() {
      const snapshot = await firestore.collection("jobPool").get();
      const postings = snapshot.docs.map((document) => JobPostingSchema.parse(document.data()));
      const latest = postings.reduce<string | null>(
        (current, posting) => !current || posting.ingestedAt > current ? posting.ingestedAt : current,
        null,
      );
      return JobPoolSummarySchema.parse({
        activePostings: postings.length,
        reviewRequired: postings.filter((posting) => posting.reviewRequired).length,
        totalRevisions: postings.reduce((total, posting) => total + posting.revision, 0),
        lastUpdatedAt: latest,
      });
    },

    async getJobPostings() {
      const snapshot = await firestore.collection("jobPool").get();
      return snapshot.docs.map((document) => JobPostingSchema.parse(document.data()));
    },

    async findBySourceIdentity(sourceAdapter, sourceIdentity) {
      return readPostingFromLookup(firestore, "jobSourceIdentities", lookupId(`${sourceAdapter}:${sourceIdentity}`));
    },

    async findByCanonicalUrl(canonicalUrl) {
      return readPostingFromLookup(firestore, "jobCanonicalUrls", lookupId(canonicalUrl));
    },

    async findByContentHash(contentHash) {
      return readPostingFromLookup(firestore, "jobContentHashes", contentHash);
    },

    async saveJobPosting(posting) {
      const batch = firestore.batch();
      batch.set(firestore.doc(`jobPool/${posting.id}`), posting);
      batch.create(firestore.doc(`jobPostings/${posting.id}/revisions/${posting.revision}`), posting);
      addLookupWrites(batch, firestore, posting.id, {
        sourceAdapter: posting.source.adapter,
        sourceIdentity: posting.source.identity,
        canonicalUrl: posting.source.canonicalUrl,
        contentHash: posting.contentHash,
      });
      await batch.commit();
    },

    async linkDuplicate(postingId, lookup) {
      const batch = firestore.batch();
      addLookupWrites(batch, firestore, postingId, lookup);
      await batch.commit();
    },
  };
}

function addLookupWrites(
  batch: FirebaseFirestore.WriteBatch,
  firestore: Firestore,
  postingId: string,
  lookup: PostingLookup,
) {
  const value = { postingId };
  if (lookup.sourceIdentity) {
    batch.set(firestore.doc(`jobSourceIdentities/${lookupId(`${lookup.sourceAdapter}:${lookup.sourceIdentity}`)}`), value);
  }
  if (lookup.canonicalUrl) {
    batch.set(firestore.doc(`jobCanonicalUrls/${lookupId(lookup.canonicalUrl)}`), value);
  }
  batch.set(firestore.doc(`jobContentHashes/${lookup.contentHash}`), value);
}

async function readPostingFromLookup(
  firestore: Firestore,
  collection: string,
  id: string,
): Promise<JobPosting | null> {
  const lookup = await firestore.doc(`${collection}/${id}`).get();
  const postingId = lookup.data()?.postingId;
  if (typeof postingId !== "string") return null;
  const posting = await firestore.doc(`jobPool/${postingId}`).get();
  return posting.exists ? JobPostingSchema.parse(posting.data()) : null;
}

function lookupId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
