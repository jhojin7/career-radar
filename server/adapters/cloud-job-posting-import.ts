import { basename, extname } from "node:path";

import { Storage } from "@google-cloud/storage";

import type { JobPostingImportAdapter } from "../collection.js";

const prefix = "job-imports/";

export function createCloudJobPostingImport(options: {
  bucketName: string;
  projectId?: string;
}): JobPostingImportAdapter {
  const storage = new Storage(options.projectId ? { projectId: options.projectId } : undefined);
  const bucket = storage.bucket(options.bucketName);
  return {
    async importJobPostings(postings) {
      return Promise.all(postings.map(async (posting) => {
        const fileName = basename(posting.fileName);
        const objectName = `${prefix}${encodeURIComponent(fileName)}`;
        await bucket.file(objectName).save(Buffer.from(posting.bytes), {
          contentType: posting.mediaType,
          metadata: {
            metadata: {
              fileName,
              sourceIdentity: posting.sourceIdentity ?? fileName,
              ...(posting.originalUrl ? { originalUrl: posting.originalUrl } : {}),
            },
          },
          resumable: false,
        });
        return { sourceKey: sourceKey(fileName), fileName };
      }));
    },

    async discover() {
      const [files] = await bucket.getFiles({ prefix });
      const documents = await Promise.all(files
        .filter((file) => [".txt", ".pdf"].includes(extname(file.name).toLowerCase()))
        .map(async (file) => {
          const [[contents], [objectMetadata]] = await Promise.all([file.download(), file.getMetadata()]);
          const custom = objectMetadata.metadata ?? {};
          const fileName = typeof custom.fileName === "string"
            ? basename(custom.fileName)
            : decodeURIComponent(file.name.slice(prefix.length));
          return {
            sourceKey: sourceKey(fileName),
            fileName,
            mediaType: extname(fileName).toLowerCase() === ".pdf"
              ? "application/pdf" as const
              : "text/plain" as const,
            bytes: new Uint8Array(contents),
            sourceAdapter: "browser-import",
            sourceIdentity: typeof custom.sourceIdentity === "string" ? custom.sourceIdentity : fileName,
            originalUrl: typeof custom.originalUrl === "string" ? custom.originalUrl : undefined,
          };
        }));
      documents.sort((left, right) => left.fileName.localeCompare(right.fileName));
      return { documents, errors: [] };
    },
  };
}

function sourceKey(fileName: string): string {
  return `browser-import:${fileName}`;
}
