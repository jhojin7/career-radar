import { createHash } from "node:crypto";

import { z } from "zod";

import type { CandidateProfile, OnboardingPersistence, SearchTargetSet } from "./onboarding.js";

export const JobPostingEvidenceSchema = z.object({
  field: z.string().trim().min(1),
  quote: z.string().trim().min(1),
  page: z.number().int().positive().optional(),
});

export const JobPostingExtractionSchema = z.object({
  title: z.string().trim().min(1),
  companyName: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  employmentTypes: z.array(z.string().trim().min(1)),
  locations: z.array(z.string().trim().min(1)),
  workModes: z.array(z.enum(["onsite", "hybrid", "remote"])),
  experience: z.object({
    minYears: z.number().int().nonnegative().nullable(),
    maxYears: z.number().int().nonnegative().nullable(),
    rawText: z.string(),
  }),
  requiredSkills: z.array(z.string().trim().min(1)),
  preferredSkills: z.array(z.string().trim().min(1)),
  responsibilities: z.array(z.string().trim().min(1)),
  closingAt: z.string().datetime().nullable(),
  evidence: z.array(JobPostingEvidenceSchema),
  reviewRequired: z.boolean(),
});

export const JobPostingSchema = JobPostingExtractionSchema.extend({
  id: z.string().min(1),
  revision: z.number().int().positive(),
  source: z.object({
    adapter: z.string().min(1),
    identity: z.string().min(1).optional(),
    fileName: z.string().min(1),
    originalUrl: z.string().url().optional(),
    canonicalUrl: z.string().url().optional(),
    rawSourceRef: z.string().min(1),
  }),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  processingState: z.enum(["normalized", "review-required"]),
  extraction: z.object({
    model: z.string().min(1),
    promptVersion: z.string().min(1),
  }),
  ingestedAt: z.string().datetime(),
});

export const CollectionRunCountsSchema = z.object({
  discovered: z.number().int().nonnegative(),
  new: z.number().int().nonnegative(),
  revised: z.number().int().nonnegative(),
  duplicate: z.number().int().nonnegative(),
  normalized: z.number().int().nonnegative(),
  reviewRequired: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export const CollectionRunSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["queued", "running", "completed", "completed-with-errors", "failed"]),
  profileId: z.string().min(1),
  profileVersion: z.number().int().positive(),
  searchTargetCount: z.number().int().positive(),
  counts: CollectionRunCountsSchema,
  errors: z.array(z.object({ sourceKey: z.string().min(1), message: z.string().min(1) })),
  sourceKeys: z.array(z.string().min(1)).min(1).optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});

export const JobPoolSummarySchema = z.object({
  activePostings: z.number().int().nonnegative(),
  reviewRequired: z.number().int().nonnegative(),
  totalRevisions: z.number().int().nonnegative(),
  lastUpdatedAt: z.string().datetime().nullable(),
});

export type JobPostingExtraction = z.infer<typeof JobPostingExtractionSchema>;
export type JobPostingEvidence = z.infer<typeof JobPostingEvidenceSchema>;
export type JobPosting = z.infer<typeof JobPostingSchema>;
export type CollectionRun = z.infer<typeof CollectionRunSchema>;
export type CollectionRunCounts = z.infer<typeof CollectionRunCountsSchema>;
export type JobPoolSummary = z.infer<typeof JobPoolSummarySchema>;

export type JobSourceDocument = {
  sourceKey: string;
  fileName: string;
  mediaType: "text/plain" | "application/pdf";
  bytes: Uint8Array;
  sourceAdapter: string;
  sourceIdentity?: string;
  originalUrl?: string;
  loadError?: string;
};

export type JobSourceError = {
  sourceKey: string;
  message: string;
};

export type JobSourceDiscovery = {
  documents: JobSourceDocument[];
  errors: JobSourceError[];
};

export type JobSource = {
  discover: (input: { searchTargets: SearchTargetSet }) => Promise<JobSourceDiscovery>;
};

export type JobPostingImport = {
  fileName: string;
  mediaType: "text/plain" | "application/pdf";
  bytes: Uint8Array;
  sourceIdentity?: string;
  originalUrl?: string;
};

export type JobPostingImportReceipt = {
  sourceKey: string;
  fileName: string;
};

export type JobPostingImportAdapter = JobSource & {
  importJobPostings: (postings: JobPostingImport[]) => Promise<JobPostingImportReceipt[]>;
};

export type JobPostingExtractionResult = {
  posting: JobPostingExtraction;
  model: string;
  promptVersion: string;
};

export type JobPostingExtractionAdapter = {
  extractJobPosting: (input: {
    source: JobSourceDocument;
    candidateProfile: CandidateProfile;
    searchTargets: SearchTargetSet;
  }) => Promise<JobPostingExtractionResult>;
};

export type JobSourceBlobStorage = {
  putJobSource: (input: JobSourceDocument & { contentHash: string }) => Promise<string>;
};

export type PostingLookup = {
  sourceAdapter: string;
  sourceIdentity?: string;
  canonicalUrl?: string;
  contentHash: string;
};

export type CollectionPersistence = {
  queueRun: (run: CollectionRun) => Promise<boolean>;
  beginRun: (run: CollectionRun) => Promise<boolean>;
  updateRun: (run: CollectionRun) => Promise<void>;
  getRun: (id: string) => Promise<CollectionRun | null>;
  getLatestRun: () => Promise<CollectionRun | null>;
  getJobPoolSummary: () => Promise<JobPoolSummary>;
  getJobPostings: () => Promise<JobPosting[]>;
  findBySourceIdentity: (sourceAdapter: string, sourceIdentity: string) => Promise<JobPosting | null>;
  findByCanonicalUrl: (canonicalUrl: string) => Promise<JobPosting | null>;
  findByContentHash: (contentHash: string) => Promise<JobPosting | null>;
  saveJobPosting: (posting: JobPosting) => Promise<void>;
  linkDuplicate: (postingId: string, lookup: PostingLookup) => Promise<void>;
};

export type CollectionDependencies = {
  source: JobSource;
  extraction: JobPostingExtractionAdapter;
  persistence: CollectionPersistence;
  blobStorage: JobSourceBlobStorage;
  onboardingPersistence: OnboardingPersistence;
  idGenerator?: () => string;
  clock?: () => Date;
  runId?: string;
};

export class CollectionPreconditionError extends Error {}
export class CollectionAlreadyActiveError extends Error {}

const emptyCounts = (): CollectionRunCounts => ({
  discovered: 0,
  new: 0,
  revised: 0,
  duplicate: 0,
  normalized: 0,
  reviewRequired: 0,
  failed: 0,
});

export async function runCollection({
  source,
  extraction,
  persistence,
  blobStorage,
  onboardingPersistence,
  idGenerator = () => crypto.randomUUID(),
  clock = () => new Date(),
  runId,
}: CollectionDependencies): Promise<CollectionRun> {
  const candidateProfile = await onboardingPersistence.getActiveProfile();
  if (!candidateProfile) {
    throw new CollectionPreconditionError("Confirm a Candidate Profile before starting a Collection Run.");
  }
  const searchTargets = await onboardingPersistence.getSearchTargets(candidateProfile.id);
  if (!searchTargets) {
    throw new CollectionPreconditionError("Confirm Search Targets before starting a Collection Run.");
  }

  const queuedRun = runId ? await persistence.getRun(runId) : null;
  const sourceKeys = queuedRun?.sourceKeys;
  const run = CollectionRunSchema.parse({
    id: runId ?? idGenerator(),
    status: "running",
    profileId: candidateProfile.id,
    profileVersion: candidateProfile.version,
    searchTargetCount: searchTargets.searchTargets.length,
    counts: emptyCounts(),
    errors: [],
    sourceKeys,
    startedAt: clock().toISOString(),
  });
  if (!await persistence.beginRun(run)) {
    throw new CollectionAlreadyActiveError("A Collection Run is already queued or running.");
  }

  let documents: JobSourceDocument[];
  try {
    const discovery = await source.discover({ searchTargets });
    documents = sourceKeys
      ? discovery.documents.filter((document) => sourceKeys.includes(document.sourceKey))
      : discovery.documents;
    run.counts.discovered = documents.length;
    const discoveryErrors = sourceKeys
      ? discovery.errors.filter((error) => sourceKeys.includes(error.sourceKey))
      : discovery.errors;
    run.errors.push(...discoveryErrors);
    run.counts.failed += discoveryErrors.length;
    if (sourceKeys && documents.length === 0 && discoveryErrors.length === 0) {
      run.errors.push(...sourceKeys.map((sourceKey) => ({
        sourceKey,
        message: "The failed Job Posting source is no longer available.",
      })));
      run.counts.failed += sourceKeys.length;
    }
    await persistence.updateRun(CollectionRunSchema.parse(run));
  } catch (error) {
    run.status = "failed";
    run.errors.push({ sourceKey: "collection-source", message: errorMessage(error) });
    run.counts.failed += 1;
    run.completedAt = clock().toISOString();
    await persistence.updateRun(CollectionRunSchema.parse(run));
    return run;
  }

  for (const document of documents) {
    try {
      if (document.loadError) throw new Error(document.loadError);
      const contentHash = hashSourceContent(document);
      const canonicalUrl = canonicalizeUrl(document.originalUrl);
      const lookup: PostingLookup = {
        sourceAdapter: document.sourceAdapter,
        sourceIdentity: document.sourceIdentity,
        canonicalUrl,
        contentHash,
      };
      const existing = await findExistingPosting(persistence, lookup);

      if (existing?.contentHash === contentHash) {
        await persistence.linkDuplicate(existing.id, lookup);
        run.counts.duplicate += 1;
        await persistence.updateRun(CollectionRunSchema.parse(run));
        continue;
      }

      const rawSourceRef = await blobStorage.putJobSource({ ...document, contentHash });
      const extracted = await extraction.extractJobPosting({ source: document, candidateProfile, searchTargets });
      const normalized = JobPostingExtractionSchema.parse(extracted.posting);
      const ingestedAt = clock().toISOString();
      const posting = JobPostingSchema.parse({
        ...normalized,
        id: existing?.id ?? idGenerator(),
        revision: existing ? existing.revision + 1 : 1,
        source: {
          adapter: document.sourceAdapter,
          identity: document.sourceIdentity,
          fileName: document.fileName,
          originalUrl: document.originalUrl,
          canonicalUrl,
          rawSourceRef,
        },
        contentHash,
        processingState: normalized.reviewRequired ? "review-required" : "normalized",
        extraction: { model: extracted.model, promptVersion: extracted.promptVersion },
        ingestedAt,
      });
      await persistence.saveJobPosting(posting);
      run.counts[existing ? "revised" : "new"] += 1;
      run.counts.normalized += 1;
      if (posting.reviewRequired) run.counts.reviewRequired += 1;
    } catch (error) {
      run.counts.failed += 1;
      run.errors.push({ sourceKey: document.sourceKey, message: errorMessage(error) });
    }
    await persistence.updateRun(CollectionRunSchema.parse(run));
  }

  run.status = run.counts.failed === 0
    ? "completed"
    : run.counts.normalized > 0 || run.counts.duplicate > 0
      ? "completed-with-errors"
      : "failed";
  run.completedAt = clock().toISOString();
  const completed = CollectionRunSchema.parse(run);
  await persistence.updateRun(completed);
  return completed;
}

export async function queueCollectionRun({
  persistence,
  onboardingPersistence,
  idGenerator = () => crypto.randomUUID(),
  clock = () => new Date(),
  sourceKeys,
}: Pick<CollectionDependencies, "persistence" | "onboardingPersistence" | "idGenerator" | "clock"> & {
  sourceKeys?: string[];
}) {
  const candidateProfile = await onboardingPersistence.getActiveProfile();
  if (!candidateProfile) {
    throw new CollectionPreconditionError("Confirm a Candidate Profile before starting a Collection Run.");
  }
  const searchTargets = await onboardingPersistence.getSearchTargets(candidateProfile.id);
  if (!searchTargets) {
    throw new CollectionPreconditionError("Confirm Search Targets before starting a Collection Run.");
  }

  const run = CollectionRunSchema.parse({
    id: idGenerator(),
    status: "queued",
    profileId: candidateProfile.id,
    profileVersion: candidateProfile.version,
    searchTargetCount: searchTargets.searchTargets.length,
    counts: emptyCounts(),
    errors: [],
    sourceKeys,
    startedAt: clock().toISOString(),
  });
  if (!await persistence.queueRun(run)) {
    throw new CollectionAlreadyActiveError("A Collection Run is already queued or running.");
  }
  return run;
}

async function findExistingPosting(
  persistence: CollectionPersistence,
  lookup: PostingLookup,
): Promise<JobPosting | null> {
  if (lookup.sourceIdentity) {
    const byIdentity = await persistence.findBySourceIdentity(lookup.sourceAdapter, lookup.sourceIdentity);
    if (byIdentity) return byIdentity;
  }
  if (lookup.canonicalUrl) {
    const byUrl = await persistence.findByCanonicalUrl(lookup.canonicalUrl);
    if (byUrl) return byUrl;
  }
  return persistence.findByContentHash(lookup.contentHash);
}

export function hashSourceContent(source: Pick<JobSourceDocument, "mediaType" | "bytes">): string {
  const content = source.mediaType === "text/plain"
    ? new TextEncoder().encode(normalizeText(new TextDecoder().decode(source.bytes)))
    : source.bytes;
  return createHash("sha256").update(content).digest("hex");
}

export function canonicalizeUrl(value?: string): string | undefined {
  if (!value) return undefined;
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || ["ref", "source"].includes(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trimEnd()).join("\n").trim();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown collection error";
}
