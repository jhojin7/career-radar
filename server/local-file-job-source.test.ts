import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { createLocalFileJobSource } from "./adapters/local-file-job-source.js";

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

    const documents = await createLocalFileJobSource(directory).discover();

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
