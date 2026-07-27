import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { createLocalFileJobSource } from "./adapters/local-file-job-source.js";
import { createLocalJobPostingImport } from "./adapters/local-job-posting-import.js";

describe("local file Job Posting source", () => {
  it("discovers only TXT and PDF files and applies optional manifest identity and URL metadata", async () => {
    const directory = await mkdtemp(join(tmpdir(), "career-radar-corpus-"));
    await Promise.all([
      writeFile(join(directory, "alpha.txt"), "Synthetic alpha posting"),
      writeFile(join(directory, "beta.pdf"), "%PDF-1.4 synthetic beta posting"),
      writeFile(join(directory, "ignored.md"), "not a posting"),
      writeFile(join(directory, "manifest.json"), JSON.stringify({
        postings: {
          "alpha.txt": {
            sourceAdapter: "synthetic-board",
            sourceIdentity: "alpha-123",
            originalUrl: "https://example.com/jobs/alpha",
          },
        },
      })),
    ]);

    const { documents, errors } = await createLocalFileJobSource(directory).discover({
      searchTargets: {
        profileId: "candidate-1",
        searchTargets: [
          { id: "target-1", title: "Platform Engineer", locations: ["Seoul"], workModes: ["hybrid"] },
          { id: "target-2", title: "Cloud Engineer", locations: ["Korea"], workModes: ["remote"] },
          { id: "target-3", title: "Infrastructure Engineer", locations: ["Seoul"], workModes: ["onsite"] },
        ],
        updatedAt: "2026-07-27T12:00:00.000Z",
        confirmedAt: "2026-07-27T12:00:00.000Z",
      },
    });

    expect(errors).toEqual([]);
    expect(documents).toHaveLength(2);
    expect(documents[0]).toMatchObject({
      fileName: "alpha.txt",
      mediaType: "text/plain",
      sourceAdapter: "synthetic-board",
      sourceIdentity: "alpha-123",
      originalUrl: "https://example.com/jobs/alpha",
    });
    expect(documents[1]).toMatchObject({
      fileName: "beta.pdf",
      mediaType: "application/pdf",
      sourceAdapter: "local-file",
      sourceIdentity: "beta.pdf",
    });
  });
});

describe("local browser Job Posting import", () => {
  it("persists imported files outside Git and rediscovers their source metadata", async () => {
    const dataRoot = await mkdtemp(join(tmpdir(), "career-radar-import-"));
    const adapter = createLocalJobPostingImport(dataRoot);
    await adapter.importJobPostings([{
      fileName: "platform.txt",
      mediaType: "text/plain",
      bytes: new TextEncoder().encode("Synthetic platform role"),
      sourceIdentity: "platform-42",
      originalUrl: "https://example.com/jobs/platform-42",
    }]);

    const discovery = await adapter.discover({
      searchTargets: {
        profileId: "candidate-1",
        searchTargets: [],
        updatedAt: "2026-07-27T12:00:00.000Z",
        confirmedAt: "2026-07-27T12:00:00.000Z",
      },
    });

    expect(discovery.errors).toEqual([]);
    expect(discovery.documents).toMatchObject([{
      sourceKey: "browser-import:platform.txt",
      sourceAdapter: "browser-import",
      sourceIdentity: "platform-42",
      originalUrl: "https://example.com/jobs/platform-42",
      fileName: "platform.txt",
      mediaType: "text/plain",
    }]);
  });
});
