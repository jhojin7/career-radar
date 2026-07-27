import { readFile, readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import { z } from "zod";

import type { JobSource } from "../collection.js";

const ManifestSchema = z.object({
  postings: z.record(z.string(), z.object({
    sourceAdapter: z.string().trim().min(1).optional(),
    sourceIdentity: z.string().trim().min(1).optional(),
    originalUrl: z.string().url().optional(),
  })).default({}),
});

export function createLocalFileJobSource(corpusDirectory: string): JobSource {
  return {
    async discover() {
      const entries = await readdir(corpusDirectory, { withFileTypes: true });
      const manifest = await readManifest(corpusDirectory);
      const postingFiles = entries
        .filter((entry) => entry.isFile() && [".txt", ".pdf"].includes(extname(entry.name).toLowerCase()))
        .sort((left, right) => left.name.localeCompare(right.name));

      return Promise.all(postingFiles.map(async (entry) => {
        const fileName = basename(entry.name);
        const extension = extname(fileName).toLowerCase();
        const metadata = manifest.postings[fileName];
        let bytes = new Uint8Array();
        let loadError: string | undefined;
        try {
          bytes = new Uint8Array(await readFile(join(corpusDirectory, fileName)));
        } catch (error) {
          loadError = error instanceof Error ? error.message : `Unable to read ${fileName}`;
        }
        return {
          sourceKey: fileName,
          fileName,
          mediaType: extension === ".pdf" ? "application/pdf" as const : "text/plain" as const,
          bytes,
          sourceAdapter: metadata?.sourceAdapter ?? "local-file",
          sourceIdentity: metadata?.sourceIdentity ?? fileName,
          originalUrl: metadata?.originalUrl,
          loadError,
        };
      }));
    },
  };
}

async function readManifest(corpusDirectory: string): Promise<z.infer<typeof ManifestSchema>> {
  try {
    const contents = await readFile(join(corpusDirectory, "manifest.json"), "utf8");
    return ManifestSchema.parse(JSON.parse(contents));
  } catch (error) {
    if (isMissingFile(error)) return { postings: {} };
    throw error;
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
