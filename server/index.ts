import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";

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
import { loadRuntimeConfig } from "./config.js";
import { createConfiguredJobSource } from "./configured-job-source.js";

const config = loadRuntimeConfig();
const webRoot = fileURLToPath(new URL("../web/", import.meta.url));
const dataRoot = fileURLToPath(new URL("../data/", import.meta.url));

const logger: Logger = {
  info: (event) => console.info(JSON.stringify(event)),
};

const app = createApp({
  logger,
  auth: config.auth,
  webAssets: createFileWebAssets(webRoot),
  blobStorage: config.storage.resumeBucket
    ? createCloudResumeBlobStorage({ bucketName: config.storage.resumeBucket, projectId: config.projectId })
    : createLocalResumeBlobStorage(dataRoot),
  onboardingPersistence: createFirestoreOnboardingPersistence({ projectId: config.firestoreProjectId }),
  profileExtraction: createVertexAiProfileExtraction({
    project: config.projectId,
    location: config.location,
    model: config.model,
    profilePromptVersion: config.prompts.profile,
    searchTargetPromptVersion: config.prompts.searchTarget,
  }),
  jobSource: createConfiguredJobSource(config.corpusDirectory),
  jobPostingExtraction: createVertexAiJobExtraction({
    project: config.projectId,
    location: config.location,
    model: config.model,
    promptVersion: config.prompts.jobPosting,
  }),
  collectionPersistence: createFirestoreCollectionPersistence({ projectId: config.firestoreProjectId }),
  jobSourceBlobStorage: config.storage.jobSourceBucket
    ? createCloudJobSourceBlobStorage({ bucketName: config.storage.jobSourceBucket, projectId: config.projectId })
    : createLocalJobSourceBlobStorage(dataRoot),
});

const server = serve({
  fetch: app.fetch,
  port: config.port,
});

console.info(`Career Radar listening on http://localhost:${config.port}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
