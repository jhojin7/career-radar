import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";

import { createCloudRunJobLauncher } from "./adapters/cloud-run-job-launcher.js";
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
import { createInProcessCollectionRunLauncher } from "./collection-run-launcher.js";
import { loadRuntimeConfig } from "./config.js";
import { createConfiguredJobSource } from "./configured-job-source.js";

const config = loadRuntimeConfig();
const webRoot = fileURLToPath(new URL("../web/", import.meta.url));
const dataRoot = fileURLToPath(new URL("../data/", import.meta.url));

const logger: Logger = {
  info: (event) => console.info(JSON.stringify(event)),
};
const onboardingPersistence = createFirestoreOnboardingPersistence({ projectId: config.firestoreProjectId });
const collectionPersistence = createFirestoreCollectionPersistence({ projectId: config.firestoreProjectId });
const collectionDependencies = {
  source: createConfiguredJobSource(config.corpusDirectory),
  extraction: createVertexAiJobExtraction({
    project: config.projectId,
    location: config.location,
    model: config.model,
    promptVersion: config.prompts.jobPosting,
  }),
  persistence: collectionPersistence,
  blobStorage: config.storage.jobSourceBucket
    ? createCloudJobSourceBlobStorage({ bucketName: config.storage.jobSourceBucket, projectId: config.projectId })
    : createLocalJobSourceBlobStorage(dataRoot),
  onboardingPersistence,
};
const collectionRunLauncher = config.mode === "production" && config.collectionJob && config.projectId
  ? createCloudRunJobLauncher({
      projectId: config.projectId,
      location: config.collectionJob.location,
      jobName: config.collectionJob.name,
    })
  : createInProcessCollectionRunLauncher(
      collectionDependencies,
      (event) => console.error(JSON.stringify(event)),
    );

const app = createApp({
  logger,
  auth: config.auth,
  webAssets: createFileWebAssets(webRoot),
  blobStorage: config.storage.resumeBucket
    ? createCloudResumeBlobStorage({ bucketName: config.storage.resumeBucket, projectId: config.projectId })
    : createLocalResumeBlobStorage(dataRoot),
  onboardingPersistence,
  profileExtraction: createVertexAiProfileExtraction({
    project: config.projectId,
    location: config.location,
    model: config.model,
    profilePromptVersion: config.prompts.profile,
    searchTargetPromptVersion: config.prompts.searchTarget,
  }),
  collectionPersistence,
  collectionRunLauncher,
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
