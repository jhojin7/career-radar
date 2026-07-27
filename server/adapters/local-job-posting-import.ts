import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import { z } from "zod";

import type { JobPostingImportAdapter } from "../collection.js";

const MetadataSchema = z.object({
  sourceIdentity: z.string().min(1),
  originalUrl: z.string().url().optional(),
});

export function createLocalJobPostingImport(dataRoot: string): JobPostingImportAdapter {
  const importDirectory = join(dataRoot, "job-imports");
  return {
    async importJobPostings(postings) {
      await mkdir(importDirectory, { recursive: true });
      return Promise.all(postings.map(async (posting) => {
        const fileName = basename(posting.fileName);
        await writeFile(join(importDirectory, fileName), posting.bytes);
        await writeFile(
          join(importDirectory, `${fileName}.json`),
          JSON.stringify({
            sourceIdentity: posting.sourceIdentity ?? fileName,
            originalUrl: posting.originalUrl,
          }),
        );
        return { sourceKey: sourceKey(fileName), fileName };
      }));
    },

    async discover() {
      let entries;
      try {
        entries = await readdir(importDirectory, { withFileTypes: true });
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          return { documents: [], errors: [] };
        }
        throw error;
      }

      const files = entries
        .filter((entry) => entry.isFile() && [".txt", ".pdf"].includes(extname(entry.name).toLowerCase()))
        .sort((left, right) => left.name.localeCompare(right.name));
      const documents = await Promise.all(files.map(async (entry) => {
        const fileName = basename(entry.name);
        const extension = extname(fileName).toLowerCase();
        const metadata = await readMetadata(importDirectory, fileName);
        return {
          sourceKey: sourceKey(fileName),
          fileName,
          mediaType: extension === ".pdf" ? "application/pdf" as const : "text/plain" as const,
          bytes: new Uint8Array(await readFile(join(importDirectory, fileName))),
          sourceAdapter: "browser-import",
          sourceIdentity: metadata.sourceIdentity,
          originalUrl: metadata.originalUrl,
        };
      }));
      return { documents, errors: [] };
    },
  };
}

async function readMetadata(directory: string, fileName: string) {
  try {
    return MetadataSchema.parse(JSON.parse(await readFile(join(directory, `${fileName}.json`), "utf8")));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { sourceIdentity: fileName };
    }
    throw error;
  }
}

function sourceKey(fileName: string): string {
  return `browser-import:${fileName}`;
}
