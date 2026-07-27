import { z } from "zod";

import { createBestEffortJobSource } from "./adapters/best-effort-job-source.js";
import { createLinkedInJobSource } from "./adapters/linkedin-job-source.js";
import { createLocalFileJobSource } from "./adapters/local-file-job-source.js";
import type { JobSource } from "./collection.js";

const LinkedInCollectionEnabledSchema = z.enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const LinkedInCollectionConfigSchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(10).default(10),
  maxQueries: z.coerce.number().int().min(1).max(5).default(5),
  recencyDays: z.coerce.number().int().min(1).max(30).default(7),
  requestDelayMs: z.coerce.number().int().min(500).max(10_000).default(1_000),
  requestTimeoutMs: z.coerce.number().int().min(1_000).max(30_000).default(10_000),
});

export function createConfiguredJobSource(
  corpusDirectory: string,
  environment: NodeJS.ProcessEnv = process.env,
): JobSource {
  const localSource = createLocalFileJobSource(corpusDirectory);
  const enabled = LinkedInCollectionEnabledSchema.parse(environment.LINKEDIN_COLLECTION_ENABLED);
  if (!enabled) return localSource;

  const config = LinkedInCollectionConfigSchema.parse({
    maxResults: environment.LINKEDIN_MAX_RESULTS,
    maxQueries: environment.LINKEDIN_MAX_QUERIES,
    recencyDays: environment.LINKEDIN_RECENCY_DAYS,
    requestDelayMs: environment.LINKEDIN_REQUEST_DELAY_MS,
    requestTimeoutMs: environment.LINKEDIN_REQUEST_TIMEOUT_MS,
  });

  return createBestEffortJobSource([
    { sourceKey: "local-file", source: localSource },
    { sourceKey: "linkedin", source: createLinkedInJobSource(config) },
  ]);
}
