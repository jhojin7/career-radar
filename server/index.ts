import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { serve } from "@hono/node-server";
import { z } from "zod";

import { createCloudResumeBlobStorage } from "./adapters/cloud-resume-blob-storage.js";
import { createCloudJobSourceBlobStorage } from "./adapters/cloud-job-source-blob-storage.js";
import { createFirestoreCollectionPersistence } from "./adapters/firestore-collection-persistence.js";
import { createFirestoreOnboardingPersistence } from "./adapters/firestore-onboarding-persistence.js";
import { createFileWebAssets } from "./adapters/file-web-assets.js";
import { createLocalJobSourceBlobStorage } from "./adapters/local-job-source-blob-storage.js";
import { createLocalResumeBlobStorage } from "./adapters/local-resume-blob-storage.js";
import { createVertexAiJobExtraction } from "./adapters/vertex-ai-job-extraction.js";
import { createVertexAiProfileExtraction } from "./adapters/vertex-ai-profile-extraction.js";
import { createApp, type Logger } from "./app.js";
import { createConfiguredJobSource } from "./configured-job-source.js";

const port = z.coerce.number().int().positive().parse(process.env.PORT ?? 3000);
const webRoot = fileURLToPath(new URL("../web/", import.meta.url));
const dataRoot = fileURLToPath(new URL("../data/", import.meta.url));
const project = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT;
const resumeBucket = process.env.RESUME_BUCKET;
const jobSourceBucket = process.env.JOB_SOURCE_BUCKET ?? resumeBucket;
const corpusDirectory = resolve(process.env.JOB_CORPUS_DIR ?? "data/job-postings");
const requiresCloudStorage = process.env.NODE_ENV === "production" || Boolean(process.env.K_SERVICE);

if (requiresCloudStorage && !resumeBucket) {
  throw new Error("RESUME_BUCKET is required in production so source PDFs use durable Cloud Storage.");
}

const logger: Logger = {
  info: (event) => console.info(JSON.stringify(event)),
};
const firestoreProjectId = process.env.FIRESTORE_PROJECT_ID ?? project ??
  (process.env.FIRESTORE_EMULATOR_HOST ? "career-radar-local" : undefined);

const app = createApp({
  logger,
  webAssets: createFileWebAssets(webRoot),
  blobStorage: resumeBucket
    ? createCloudResumeBlobStorage({ bucketName: resumeBucket, projectId: project })
    : createLocalResumeBlobStorage(dataRoot),
  onboardingPersistence: createFirestoreOnboardingPersistence({ projectId: firestoreProjectId }),
  profileExtraction: createVertexAiProfileExtraction({
    project,
    location: process.env.GOOGLE_CLOUD_LOCATION,
    model: process.env.GEMINI_MODEL,
  }),
  jobSource: createConfiguredJobSource(corpusDirectory),
  jobPostingExtraction: createVertexAiJobExtraction({
    project,
    location: process.env.GOOGLE_CLOUD_LOCATION,
    model: process.env.GEMINI_MODEL,
  }),
  collectionPersistence: createFirestoreCollectionPersistence({ projectId: firestoreProjectId }),
  jobSourceBlobStorage: jobSourceBucket
    ? createCloudJobSourceBlobStorage({ bucketName: jobSourceBucket, projectId: project })
    : createLocalJobSourceBlobStorage(dataRoot),
});

const server = serve({
  fetch: app.fetch,
  port,
});

console.info(`Career Radar listening on http://localhost:${port}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
