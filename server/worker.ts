import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { createCloudJobSourceBlobStorage } from "./adapters/cloud-job-source-blob-storage.js";
import { createFirestoreCollectionPersistence } from "./adapters/firestore-collection-persistence.js";
import { createFirestoreOnboardingPersistence } from "./adapters/firestore-onboarding-persistence.js";
import { createLocalFileJobSource } from "./adapters/local-file-job-source.js";
import { createLocalJobSourceBlobStorage } from "./adapters/local-job-source-blob-storage.js";
import { createVertexAiJobExtraction } from "./adapters/vertex-ai-job-extraction.js";
import { runCollection } from "./collection.js";

const project = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT;
const firestoreProjectId = process.env.FIRESTORE_PROJECT_ID ?? project ??
  (process.env.FIRESTORE_EMULATOR_HOST ? "career-radar-local" : undefined);
const corpusDirectory = resolve(process.env.JOB_CORPUS_DIR ?? "data/job-postings");
const dataRoot = fileURLToPath(new URL("../data/", import.meta.url));
const bucketName = process.env.JOB_SOURCE_BUCKET ?? process.env.RESUME_BUCKET;
const requiresCloudStorage = process.env.NODE_ENV === "production" || Boolean(process.env.K_SERVICE);

if (requiresCloudStorage && !bucketName) {
  throw new Error("JOB_SOURCE_BUCKET or RESUME_BUCKET is required so raw Job Posting sources use durable storage.");
}

try {
  const collectionRun = await runCollection({
    source: createLocalFileJobSource(corpusDirectory),
    extraction: createVertexAiJobExtraction({
      project,
      location: process.env.GOOGLE_CLOUD_LOCATION,
      model: process.env.GEMINI_MODEL,
    }),
    persistence: createFirestoreCollectionPersistence({ projectId: firestoreProjectId }),
    blobStorage: bucketName
      ? createCloudJobSourceBlobStorage({ bucketName, projectId: project })
      : createLocalJobSourceBlobStorage(dataRoot),
    onboardingPersistence: createFirestoreOnboardingPersistence({ projectId: firestoreProjectId }),
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
