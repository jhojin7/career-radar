import { extname } from "node:path";

import { Storage } from "@google-cloud/storage";

import type { JobSourceBlobStorage } from "../collection.js";

export function createCloudJobSourceBlobStorage(options: { bucketName: string; projectId?: string }): JobSourceBlobStorage {
  const storage = new Storage(options.projectId ? { projectId: options.projectId } : undefined);
  const bucket = storage.bucket(options.bucketName);
  return {
    async putJobSource({ bytes, fileName, mediaType, contentHash }) {
      const extension = [".txt", ".pdf"].includes(extname(fileName).toLowerCase())
        ? extname(fileName).toLowerCase()
        : "";
      const objectName = `job-sources/${contentHash}${extension}`;
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (!exists) {
        await file.save(Buffer.from(bytes), {
          contentType: mediaType,
          resumable: false,
          preconditionOpts: { ifGenerationMatch: 0 },
        });
      }
      return `gs://${options.bucketName}/${objectName}`;
    },
  };
}
