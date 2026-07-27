import { describe, expect, it } from "vitest";

import { createApp, type Logger } from "./app.js";
import type {
  CollectionPersistence,
  CollectionRun,
  JobPosting,
  JobPostingExtraction,
  JobSourceDocument,
  PostingLookup,
} from "./collection.js";
import type { CandidateProfile, OnboardingPersistence, SearchTargetSet } from "./onboarding.js";

const silentLogger: Logger = { info: () => undefined };
const now = "2026-07-27T12:00:00.000Z";
const candidateProfile = {
  id: "candidate-1",
  version: 1,
  draftId: "draft-1",
  status: "active",
  profile: {
    fullName: "Synthetic Candidate", email: "", phone: "", headline: "Platform engineer", summary: "",
    experience: [], education: [], skills: [{ name: "TypeScript", evidence: [{ quote: "TypeScript" }] }],
    projects: [], uncertainties: [], careerGoals: [], preferredLocations: ["Seoul"], workModes: ["hybrid"],
    disqualifyingConditions: [], fitWeights: { technical: 40, experience: 25, careerDirection: 25, workConditions: 10 },
  },
  confirmedAt: now,
} satisfies CandidateProfile;
const searchTargets = {
  profileId: candidateProfile.id,
  searchTargets: [
    { id: "target-1", title: "Platform Engineer", locations: ["Seoul"], workModes: ["hybrid"] },
    { id: "target-2", title: "Cloud Engineer", locations: ["Korea"], workModes: ["remote"] },
    { id: "target-3", title: "Developer Experience Engineer", locations: ["Seoul"], workModes: ["onsite"] },
  ],
  updatedAt: now,
  confirmedAt: now,
} satisfies SearchTargetSet;

const normalizedPosting: JobPostingExtraction = {
  title: "Platform Engineer",
  companyName: "Synthetic Systems",
  summary: "Build internal developer platforms.",
  employmentTypes: ["full-time"],
  locations: ["Seoul"],
  workModes: ["hybrid"],
  experience: { minYears: 2, maxYears: 4, rawText: "2–4 years" },
  requiredSkills: ["TypeScript"],
  preferredSkills: ["GCP"],
  responsibilities: ["Build platform services"],
  closingAt: null,
  evidence: [{ field: "requiredSkills", quote: "TypeScript" }],
  reviewRequired: false,
};

class MemoryCollectionPersistence implements CollectionPersistence {
  runs: CollectionRun[] = [];
  postings = new Map<string, JobPosting>();
  sourceAliases = new Map<string, string>();
  urlAliases = new Map<string, string>();
  contentAliases = new Map<string, string>();

  async createRun(run: CollectionRun) { this.runs.push(structuredClone(run)); }
  async updateRun(run: CollectionRun) {
    const index = this.runs.findIndex((candidate) => candidate.id === run.id);
    this.runs[index] = structuredClone(run);
  }
  async getLatestRun() { return structuredClone(this.runs.at(-1) ?? null); }
  async getJobPoolSummary() {
    const postings = [...this.postings.values()];
    return {
      activePostings: postings.length,
      reviewRequired: postings.filter((posting) => posting.reviewRequired).length,
      totalRevisions: postings.reduce((total, posting) => total + posting.revision, 0),
      lastUpdatedAt: postings.at(-1)?.ingestedAt ?? null,
    };
  }
  async findBySourceIdentity(adapter: string, identity: string) { return this.posting(this.sourceAliases.get(`${adapter}:${identity}`)); }
  async findByCanonicalUrl(url: string) { return this.posting(this.urlAliases.get(url)); }
  async findByContentHash(hash: string) { return this.posting(this.contentAliases.get(hash)); }
  async saveJobPosting(posting: JobPosting) {
    this.postings.set(posting.id, structuredClone(posting));
    this.link(posting.id, {
      sourceAdapter: posting.source.adapter,
      sourceIdentity: posting.source.identity,
      canonicalUrl: posting.source.canonicalUrl,
      contentHash: posting.contentHash,
    });
  }
  async linkDuplicate(postingId: string, lookup: PostingLookup) { this.link(postingId, lookup); }
  private posting(id?: string) { return id ? structuredClone(this.postings.get(id) ?? null) : null; }
  private link(postingId: string, lookup: PostingLookup) {
    if (lookup.sourceIdentity) this.sourceAliases.set(`${lookup.sourceAdapter}:${lookup.sourceIdentity}`, postingId);
    if (lookup.canonicalUrl) this.urlAliases.set(lookup.canonicalUrl, postingId);
    this.contentAliases.set(lookup.contentHash, postingId);
  }
}

function document(identity: string, text: string, options: Partial<JobSourceDocument> = {}): JobSourceDocument {
  return {
    sourceKey: `${identity}.txt`,
    fileName: `${identity}.txt`,
    mediaType: "text/plain",
    bytes: new TextEncoder().encode(text),
    sourceAdapter: "fixture",
    sourceIdentity: identity,
    ...options,
  };
}

function createFixture(documents: JobSourceDocument[], persistence = new MemoryCollectionPersistence()) {
  let inputs = documents;
  let extractionCalls = 0;
  let nextId = 0;
  const onboardingPersistence = {
    getActiveProfile: async () => candidateProfile,
    getSearchTargets: async () => searchTargets,
  } as unknown as OnboardingPersistence;
  const app = createApp({
    logger: silentLogger,
    onboardingPersistence,
    jobSource: { discover: async () => inputs },
    jobPostingExtraction: {
      extractJobPosting: async ({ source }) => {
        extractionCalls += 1;
        const text = new TextDecoder().decode(source.bytes);
        if (text.includes("MALFORMED")) throw new Error("Synthetic extraction failure");
        return {
          posting: { ...normalizedPosting, reviewRequired: text.includes("REVIEW") },
          model: "fake-extractor",
          promptVersion: "fixture-v1",
        };
      },
    },
    collectionPersistence: persistence,
    jobSourceBlobStorage: { putJobSource: async ({ contentHash }) => `memory://raw/${contentHash}` },
    idGenerator: () => `id-${++nextId}`,
    clock: () => new Date(now),
  });
  return {
    app,
    persistence,
    extractionCalls: () => extractionCalls,
    replaceDocuments: (next: JobSourceDocument[]) => { inputs = next; },
  };
}

describe("Job Pool collection Hono interface", () => {
  it("imports TXT and PDF sources into the same validated Job Posting representation", async () => {
    const fixture = createFixture([
      document("txt-posting", "Synthetic posting"),
      document("pdf-posting", "%PDF-1.4 REVIEW synthetic posting", {
        fileName: "pdf-posting.pdf",
        sourceKey: "pdf-posting.pdf",
        mediaType: "application/pdf",
        originalUrl: "https://EXAMPLE.com/jobs/platform/?utm_source=fixture#details",
      }),
    ]);

    const response = await fixture.app.request("/api/collection-runs", { method: "POST" });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      collectionRun: { status: "completed", counts: { discovered: 2, new: 2, normalized: 2, reviewRequired: 1, failed: 0 } },
      jobPoolSummary: { activePostings: 2, reviewRequired: 1, totalRevisions: 2 },
    });
    const postings = [...fixture.persistence.postings.values()];
    expect(postings.map(({ title, companyName }) => ({ title, companyName }))).toEqual([
      { title: normalizedPosting.title, companyName: normalizedPosting.companyName },
      { title: normalizedPosting.title, companyName: normalizedPosting.companyName },
    ]);
    expect(postings[1]?.source).toMatchObject({
      originalUrl: "https://EXAMPLE.com/jobs/platform/?utm_source=fixture#details",
      canonicalUrl: "https://example.com/jobs/platform",
      rawSourceRef: expect.stringMatching(/^memory:\/\/raw\//),
    });
  });

  it("skips repeated identical input before extraction", async () => {
    const fixture = createFixture([document("posting-1", "same posting")]);
    await fixture.app.request("/api/collection-runs", { method: "POST" });
    const response = await fixture.app.request("/api/collection-runs", { method: "POST" });

    await expect(response.json()).resolves.toMatchObject({
      collectionRun: { counts: { new: 0, revised: 0, duplicate: 1, normalized: 0 } },
      jobPoolSummary: { activePostings: 1, totalRevisions: 1 },
    });
    expect(fixture.extractionCalls()).toBe(1);
  });

  it("creates a revision when source identity content changes", async () => {
    const fixture = createFixture([document("posting-1", "first revision")]);
    await fixture.app.request("/api/collection-runs", { method: "POST" });
    fixture.replaceDocuments([document("posting-1", "changed revision")]);
    const response = await fixture.app.request("/api/collection-runs", { method: "POST" });

    await expect(response.json()).resolves.toMatchObject({
      collectionRun: { counts: { new: 0, revised: 1, duplicate: 0, normalized: 1 } },
      jobPoolSummary: { activePostings: 1, totalRevisions: 2 },
    });
    expect([...fixture.persistence.postings.values()][0]?.revision).toBe(2);
  });

  it("does not create multiple feed entries for duplicate content under different identities", async () => {
    const fixture = createFixture([
      document("source-a", "identical content"),
      document("source-b", "identical content"),
    ]);
    const response = await fixture.app.request("/api/collection-runs", { method: "POST" });

    await expect(response.json()).resolves.toMatchObject({
      collectionRun: { counts: { new: 1, duplicate: 1, normalized: 1 } },
      jobPoolSummary: { activePostings: 1 },
    });
  });

  it("completes with errors while valid postings enter the Job Pool", async () => {
    const fixture = createFixture([
      document("valid", "valid posting"),
      document("broken", "MALFORMED posting"),
    ]);
    const response = await fixture.app.request("/api/collection-runs", { method: "POST" });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      collectionRun: {
        status: "completed-with-errors",
        counts: { discovered: 2, new: 1, normalized: 1, failed: 1 },
        errors: [{ sourceKey: "broken.txt", message: "Synthetic extraction failure" }],
      },
      jobPoolSummary: { activePostings: 1 },
    });
  });
});
