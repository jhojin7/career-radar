import { describe, expect, it } from "vitest";

import { createApp, type Logger } from "./app.js";
import type {
  CollectionPersistence,
  CollectionRun,
  JobPosting,
  JobPostingExtraction,
  JobSourceError,
  JobSourceDocument,
  PostingLookup,
} from "./collection.js";
import { runCollection } from "./collection.js";
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
  activeRunId: string | null = null;

  async queueRun(run: CollectionRun) {
    if (this.activeRunId) return false;
    this.activeRunId = run.id;
    this.runs.push(structuredClone(run));
    return true;
  }
  async beginRun(run: CollectionRun) {
    const existing = this.runs.findIndex((candidate) => candidate.id === run.id);
    if (existing >= 0) {
      if (this.runs[existing]?.status !== "queued" || this.activeRunId !== run.id) return false;
      this.runs[existing] = structuredClone(run);
      return true;
    }
    if (this.activeRunId) return false;
    this.activeRunId = run.id;
    this.runs.push(structuredClone(run));
    return true;
  }
  async updateRun(run: CollectionRun) {
    const index = this.runs.findIndex((candidate) => candidate.id === run.id);
    this.runs[index] = structuredClone(run);
    if (["completed", "completed-with-errors", "failed"].includes(run.status)) this.activeRunId = null;
  }
  async getRun(id: string) { return structuredClone(this.runs.find((run) => run.id === id) ?? null); }
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
  async getJobPostings() { return [...this.postings.values()].map((posting) => structuredClone(posting)); }
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

function createFixture(
  documents: JobSourceDocument[],
  persistence = new MemoryCollectionPersistence(),
  sourceErrors: JobSourceError[] = [],
) {
  let inputs = documents;
  let extractionCalls = 0;
  let nextId = 0;
  let execution = Promise.resolve<CollectionRun | null>(null);
  const onboardingPersistence = {
    getActiveProfile: async () => candidateProfile,
    getSearchTargets: async () => searchTargets,
  } as unknown as OnboardingPersistence;
  const dependencies = {
    source: { discover: async () => ({ documents: inputs, errors: sourceErrors }) },
    extraction: {
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
    persistence,
    blobStorage: { putJobSource: async ({ contentHash }) => `memory://raw/${contentHash}` },
    onboardingPersistence,
    idGenerator: () => `id-${++nextId}`,
    clock: () => new Date(now),
  } satisfies Parameters<typeof runCollection>[0];
  const app = createApp({
    logger: silentLogger,
    onboardingPersistence,
    collectionPersistence: persistence,
    collectionRunLauncher: {
      start: async ({ runId }) => { execution = runCollection({ ...dependencies, runId }); },
    },
    idGenerator: dependencies.idGenerator,
    clock: dependencies.clock,
  });
  return {
    app,
    persistence,
    extractionCalls: () => extractionCalls,
    replaceDocuments: (next: JobSourceDocument[]) => { inputs = next; },
    waitForExecution: async () => execution,
    async collect() {
      const response = await app.request("/api/collection-runs", { method: "POST" });
      if (response.status === 202) await execution;
      return { response, state: await (await app.request("/api/collection/state")).json() };
    },
  };
}

describe("Job Pool collection Hono interface", () => {
  it("queues an on-demand run without holding the request open and rejects a duplicate", async () => {
    const persistence = new MemoryCollectionPersistence();
    const onboardingPersistence = {
      getActiveProfile: async () => candidateProfile,
      getSearchTargets: async () => searchTargets,
    } as unknown as OnboardingPersistence;
    const app = createApp({
      logger: silentLogger,
      onboardingPersistence,
      collectionPersistence: persistence,
      collectionRunLauncher: { start: async () => undefined },
      idGenerator: () => "queued-run",
      clock: () => new Date(now),
    });

    const first = await app.request("/api/collection-runs", { method: "POST" });
    expect(first.status).toBe(202);
    await expect(first.json()).resolves.toMatchObject({ collectionRun: { id: "queued-run", status: "queued" } });

    const duplicate = await app.request("/api/collection-runs", { method: "POST" });
    expect(duplicate.status).toBe(409);
    await expect(duplicate.json()).resolves.toMatchObject({
      error: { code: "collection_run_active", message: "A Collection Run is already queued or running." },
    });
  });

  it("marks a queued run failed when Cloud Run rejects the launch", async () => {
    const persistence = new MemoryCollectionPersistence();
    const onboardingPersistence = {
      getActiveProfile: async () => candidateProfile,
      getSearchTargets: async () => searchTargets,
    } as unknown as OnboardingPersistence;
    const app = createApp({
      logger: silentLogger,
      onboardingPersistence,
      collectionPersistence: persistence,
      collectionRunLauncher: { start: async () => { throw new Error("Synthetic launch rejection"); } },
      idGenerator: () => "failed-launch",
      clock: () => new Date(now),
    });

    const response = await app.request("/api/collection-runs", { method: "POST" });
    expect(response.status).toBe(502);
    expect(await persistence.getRun("failed-launch")).toMatchObject({
      status: "failed",
      counts: { failed: 1 },
      errors: [{ sourceKey: "collection-run", message: "Synthetic launch rejection" }],
    });
    expect(persistence.activeRunId).toBeNull();
  });

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

    const { response, state } = await fixture.collect();
    expect(response.status).toBe(202);
    expect(state).toMatchObject({
      latestRun: { status: "completed", counts: { discovered: 2, new: 2, normalized: 2, reviewRequired: 1, failed: 0 } },
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

  it("accepts a multi-file browser import and preserves supplied source metadata", async () => {
    const imported: JobSourceDocument[] = [];
    const jobPostingImport = {
      async importJobPostings(postings: Array<{
        fileName: string;
        mediaType: "text/plain" | "application/pdf";
        bytes: Uint8Array;
        sourceIdentity?: string;
        originalUrl?: string;
      }>) {
        imported.push(...postings.map((posting) => ({
          ...posting,
          sourceKey: `browser-import:${posting.fileName}`,
          sourceAdapter: "browser-import",
        })));
        return imported.map(({ sourceKey, fileName }) => ({ sourceKey, fileName }));
      },
      async discover() { return { documents: imported, errors: [] }; },
    };
    const app = createApp({ logger: silentLogger, jobPostingImport });
    const form = new FormData();
    form.append("postings", new File(["Platform role"], "platform.txt", { type: "text/plain" }));
    form.append("postings", new File(["%PDF-1.4 synthetic"], "cloud.pdf", { type: "application/pdf" }));
    form.set("metadata", JSON.stringify({
      "platform.txt": {
        sourceIdentity: "posting-42",
        originalUrl: "https://example.com/jobs/42",
      },
    }));

    const response = await app.request("/api/job-postings/import", { method: "POST", body: form });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ imports: [
      { sourceKey: "browser-import:platform.txt", fileName: "platform.txt" },
      { sourceKey: "browser-import:cloud.pdf", fileName: "cloud.pdf" },
    ] });
    expect(imported).toMatchObject([
      { sourceIdentity: "posting-42", originalUrl: "https://example.com/jobs/42", mediaType: "text/plain" },
      { mediaType: "application/pdf" },
    ]);
  });

  it("rejects unsupported files before storing a browser import", async () => {
    let writes = 0;
    const app = createApp({
      logger: silentLogger,
      jobPostingImport: {
        importJobPostings: async () => { writes += 1; return []; },
        discover: async () => ({ documents: [], errors: [] }),
      },
    });
    const form = new FormData();
    form.append("postings", new File(["not supported"], "posting.docx"));

    const response = await app.request("/api/job-postings/import", { method: "POST", body: form });

    expect(response.status).toBe(415);
    expect(writes).toBe(0);
  });

  it("skips repeated identical input before extraction", async () => {
    const fixture = createFixture([document("posting-1", "same posting")]);
    await fixture.collect();
    const { state } = await fixture.collect();

    expect(state).toMatchObject({
      latestRun: { counts: { new: 0, revised: 0, duplicate: 1, normalized: 0 } },
      jobPoolSummary: { activePostings: 1, totalRevisions: 1 },
    });
    expect(fixture.extractionCalls()).toBe(1);
  });

  it("creates a revision when source identity content changes", async () => {
    const fixture = createFixture([document("posting-1", "first revision")]);
    await fixture.collect();
    fixture.replaceDocuments([document("posting-1", "changed revision")]);
    const { state } = await fixture.collect();

    expect(state).toMatchObject({
      latestRun: { counts: { new: 0, revised: 1, duplicate: 0, normalized: 1 } },
      jobPoolSummary: { activePostings: 1, totalRevisions: 2 },
    });
    expect([...fixture.persistence.postings.values()][0]?.revision).toBe(2);
  });

  it("does not create multiple feed entries for duplicate content under different identities", async () => {
    const fixture = createFixture([
      document("source-a", "identical content"),
      document("source-b", "identical content"),
    ]);
    const { state } = await fixture.collect();

    expect(state).toMatchObject({
      latestRun: { counts: { new: 1, duplicate: 1, normalized: 1 } },
      jobPoolSummary: { activePostings: 1 },
    });
  });

  it("completes with errors while valid postings enter the Job Pool", async () => {
    const fixture = createFixture([
      document("valid", "valid posting"),
      document("broken", "MALFORMED posting"),
    ]);
    const { response, state } = await fixture.collect();

    expect(response.status).toBe(202);
    expect(state).toMatchObject({
      latestRun: {
        status: "completed-with-errors",
        counts: { discovered: 2, new: 1, normalized: 1, failed: 1 },
        errors: [{ sourceKey: "broken.txt", message: "Synthetic extraction failure" }],
      },
      jobPoolSummary: { activePostings: 1 },
    });
  });

  it("retries only the selected failed Job Posting in a new Collection Run", async () => {
    const fixture = createFixture([
      document("valid", "valid posting"),
      document("broken", "MALFORMED posting"),
    ]);
    await fixture.collect();
    fixture.replaceDocuments([
      document("valid", "valid posting"),
      document("broken", "repaired posting"),
    ]);

    const response = await fixture.app.request(
      `/api/failed-postings/${encodeURIComponent("broken.txt")}/retry`,
      { method: "POST" },
    );
    expect(response.status).toBe(202);
    await fixture.waitForExecution();
    const state = await (await fixture.app.request("/api/collection/state")).json() as { latestRun: CollectionRun };

    expect(state.latestRun).toMatchObject({
      status: "completed",
      sourceKeys: ["broken.txt"],
      counts: { discovered: 1, new: 1, normalized: 1, failed: 0 },
    });
    expect(fixture.extractionCalls()).toBe(3);
  });

  it("records discovery diagnostics without discarding postings returned by another source", async () => {
    const fixture = createFixture(
      [document("valid", "valid posting")],
      new MemoryCollectionPersistence(),
      [{ sourceKey: "optional-source", message: "Synthetic source unavailable" }],
    );
    const { state } = await fixture.collect();

    expect(state).toMatchObject({
      latestRun: {
        status: "completed-with-errors",
        counts: { discovered: 1, new: 1, normalized: 1, failed: 1 },
        errors: [{ sourceKey: "optional-source", message: "Synthetic source unavailable" }],
      },
      jobPoolSummary: { activePostings: 1 },
    });
  });
});
