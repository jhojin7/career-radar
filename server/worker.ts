import { fileURLToPath } from "node:url";

import { createCloudJobSourceBlobStorage } from "./adapters/cloud-job-source-blob-storage.js";
import { createFirestoreCollectionPersistence } from "./adapters/firestore-collection-persistence.js";
import { createFirestoreOnboardingPersistence } from "./adapters/firestore-onboarding-persistence.js";
import { createLocalJobSourceBlobStorage } from "./adapters/local-job-source-blob-storage.js";
import { createVertexAiJobExtraction } from "./adapters/vertex-ai-job-extraction.js";
import { failQueuedRun } from "./collection-run-launcher.js";
import { runCollection } from "./collection.js";
import { loadRuntimeConfig } from "./config.js";
import { createConfiguredJobSource } from "./configured-job-source.js";

const config = loadRuntimeConfig(process.env, { service: false });
const dataRoot = fileURLToPath(new URL("../data/", import.meta.url));
const persistence = createFirestoreCollectionPersistence({ projectId: config.firestoreProjectId });
let runId = process.env.COLLECTION_RUN_ID;

try {
  if (!runId) {
    const latestRun = await persistence.getLatestRun();
    if (latestRun?.status === "queued") runId = latestRun.id;
  }
  const collectionRun = await runCollection({
    source: createConfiguredJobSource(config.corpusDirectory),
    extraction: createVertexAiJobExtraction({
      project: config.projectId,
      location: config.location,
      model: config.model,
      promptVersion: config.prompts.jobPosting,
    }),
    persistence,
    blobStorage: config.storage.jobSourceBucket
      ? createCloudJobSourceBlobStorage({ bucketName: config.storage.jobSourceBucket, projectId: config.projectId })
      : createLocalJobSourceBlobStorage(dataRoot),
    onboardingPersistence: createFirestoreOnboardingPersistence({ projectId: config.firestoreProjectId }),
    runId,
  });
  console.info(JSON.stringify({ event: "collection_run_completed", collectionRun }));
  if (collectionRun.status === "failed") process.exitCode = 1;
} catch (error) {
  if (runId) {
    await failQueuedRun(
      persistence,
      runId,
      error instanceof Error ? error.message : "Unknown collection error",
    ).catch(() => undefined);
  }
  console.error(JSON.stringify({
    event: "collection_run_crashed",
    message: error instanceof Error ? error.message : "Unknown collection error",
  }));
  process.exitCode = 1;
}
