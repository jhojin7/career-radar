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

const queuedLeaseMs = 15 * 60 * 1_000;
const runningLeaseMs = 2 * 60 * 60 * 1_000;

export function createFirestoreCollectionPersistence(options: { projectId?: string } = {}): CollectionPersistence {
  const firestore = new Firestore({
    ...(options.projectId ? { projectId: options.projectId } : {}),
    ignoreUndefinedProperties: true,
  });

  return {
    async queueRun(run) {
      return reserveRun(firestore, run, "queued");
    },

    async beginRun(run) {
      return reserveRun(firestore, run, "running");
    },

    async updateRun(run) {
      const runRef = firestore.doc(`collectionRuns/${run.id}`);
      const activeRunRef = firestore.doc("collectionControl/activeRun");
      await firestore.runTransaction(async (transaction) => {
        const activeRun = await transaction.get(activeRunRef);
        transaction.set(runRef, run);
        if (isTerminal(run.status) && activeRun.data()?.runId === run.id) {
          transaction.delete(activeRunRef);
        } else if (run.status === "running" && activeRun.data()?.runId === run.id) {
          transaction.set(activeRunRef, activeRunValue(run.id, runningLeaseMs));
        }
      });
    },

    async getRun(id) {
      const snapshot = await firestore.doc(`collectionRuns/${id}`).get();
      return snapshot.exists ? CollectionRunSchema.parse(snapshot.data()) : null;
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

async function reserveRun(
  firestore: Firestore,
  run: Parameters<CollectionPersistence["queueRun"]>[0],
  status: "queued" | "running",
): Promise<boolean> {
  const runRef = firestore.doc(`collectionRuns/${run.id}`);
  const activeRunRef = firestore.doc("collectionControl/activeRun");
  return firestore.runTransaction(async (transaction) => {
    const [activeRun, existingRun] = await Promise.all([
      transaction.get(activeRunRef),
      transaction.get(runRef),
    ]);

    if (status === "running" && existingRun.exists) {
      const queued = CollectionRunSchema.parse(existingRun.data());
      if (queued.status !== "queued" || activeRun.data()?.runId !== run.id) return false;
      transaction.set(runRef, run);
      transaction.set(activeRunRef, activeRunValue(run.id, runningLeaseMs));
      return true;
    }
    if (isLiveLock(activeRun.data()) || existingRun.exists) return false;

    transaction.create(runRef, run);
    transaction.set(activeRunRef, activeRunValue(run.id, status === "queued" ? queuedLeaseMs : runningLeaseMs));
    return true;
  });
}

function activeRunValue(runId: string, leaseMs: number) {
  return { runId, expiresAt: new Date(Date.now() + leaseMs).toISOString() };
}

function isLiveLock(value: FirebaseFirestore.DocumentData | undefined): boolean {
  return typeof value?.runId === "string" &&
    typeof value.expiresAt === "string" &&
    value.expiresAt > new Date().toISOString();
}

function isTerminal(status: Parameters<CollectionPersistence["updateRun"]>[0]["status"]): boolean {
  return status === "completed" || status === "completed-with-errors" || status === "failed";
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
