import { randomUUID } from "node:crypto";

import { Storage } from "@google-cloud/storage";

import type { ResumeBlobStorage } from "../onboarding.js";

export function createCloudResumeBlobStorage(options: { bucketName: string; projectId?: string }): ResumeBlobStorage {
  const storage = new Storage(options.projectId ? { projectId: options.projectId } : undefined);
  const bucket = storage.bucket(options.bucketName);

  return {
    async putResume({ bytes, contentType }) {
      const objectName = `resumes/${randomUUID()}.pdf`;
      await bucket.file(objectName).save(Buffer.from(bytes), {
        contentType,
        resumable: false,
        preconditionOpts: { ifGenerationMatch: 0 },
      });
      return `gs://${options.bucketName}/${objectName}`;
    },
  };
}
