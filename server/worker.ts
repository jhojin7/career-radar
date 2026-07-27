import { fileURLToPath } from "node:url";

import { createCloudJobSourceBlobStorage } from "./adapters/cloud-job-source-blob-storage.js";
import { createFirestoreCollectionPersistence } from "./adapters/firestore-collection-persistence.js";
import { createFirestoreOnboardingPersistence } from "./adapters/firestore-onboarding-persistence.js";
import { createLocalJobSourceBlobStorage } from "./adapters/local-job-source-blob-storage.js";
import { createVertexAiJobExtraction } from "./adapters/vertex-ai-job-extraction.js";
import { runCollection } from "./collection.js";
import { loadRuntimeConfig } from "./config.js";
import { createConfiguredJobSource } from "./configured-job-source.js";

const config = loadRuntimeConfig(process.env, { service: false });
const dataRoot = fileURLToPath(new URL("../data/", import.meta.url));

try {
  const collectionRun = await runCollection({
    source: createConfiguredJobSource(config.corpusDirectory),
    extraction: createVertexAiJobExtraction({
      project: config.projectId,
      location: config.location,
      model: config.model,
      promptVersion: config.prompts.jobPosting,
    }),
    persistence: createFirestoreCollectionPersistence({ projectId: config.firestoreProjectId }),
    blobStorage: config.storage.jobSourceBucket
      ? createCloudJobSourceBlobStorage({ bucketName: config.storage.jobSourceBucket, projectId: config.projectId })
      : createLocalJobSourceBlobStorage(dataRoot),
    onboardingPersistence: createFirestoreOnboardingPersistence({ projectId: config.firestoreProjectId }),
  });
  console.info(JSON.stringify({ event: "collection_run_completed", collectionRun }));
  if (collectionRun.status === "failed") process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    event: "collection_run_crashed",
    message: error instanceof Error ? error.message : "Unknown collection error",
  }));
  process.exitCode = 1;
}
