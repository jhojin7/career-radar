import { resolve } from "node:path";

import { z } from "zod";

const EnvironmentSchema = z.object({
  APP_ENV: z.enum(["local", "production"]),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  GOOGLE_CLOUD_PROJECT: z.string().trim().min(1).optional(),
  GCLOUD_PROJECT: z.string().trim().min(1).optional(),
  FIRESTORE_PROJECT_ID: z.string().trim().min(1).optional(),
  FIRESTORE_EMULATOR_HOST: z.string().trim().min(1).optional(),
  GOOGLE_CLOUD_LOCATION: z.string().trim().min(1).default("global"),
  GEMINI_MODEL: z.string().trim().min(1).default("gemini-2.5-flash"),
  PROFILE_PROMPT_VERSION: z.string().trim().min(1).default("profile-v1"),
  SEARCH_TARGET_PROMPT_VERSION: z.string().trim().min(1).default("search-target-v1"),
  JOB_POSTING_PROMPT_VERSION: z.string().trim().min(1).default("job-posting-v1"),
  RESUME_BUCKET: z.string().trim().min(1).optional(),
  JOB_SOURCE_BUCKET: z.string().trim().min(1).optional(),
  JOB_CORPUS_DIR: z.string().trim().min(1).default("data/job-postings"),
  SHARED_PASSWORD: z.string().min(1).optional(),
  COOKIE_SIGNING_SECRET: z.string().min(32).optional(),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(604_800).default(43_200),
});

export type RuntimeConfig = ReturnType<typeof loadRuntimeConfig>;

export function loadRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
  options: { service?: boolean } = {},
) {
  const service = options.service ?? true;
  const appEnvironment = environment.APP_ENV ??
    (environment.K_SERVICE || environment.CLOUD_RUN_JOB ? "production" : "local");
  const parsed = EnvironmentSchema.parse({ ...environment, APP_ENV: appEnvironment });
  const projectId = parsed.GOOGLE_CLOUD_PROJECT ?? parsed.GCLOUD_PROJECT;
  const firestoreProjectId = parsed.FIRESTORE_PROJECT_ID ?? projectId ??
    (parsed.FIRESTORE_EMULATOR_HOST ? "career-radar-local" : undefined);
  const jobSourceBucket = parsed.JOB_SOURCE_BUCKET ?? parsed.RESUME_BUCKET;

  if (parsed.APP_ENV === "production") {
    const missing = [
      ["GOOGLE_CLOUD_PROJECT", projectId],
      ...(service ? [["RESUME_BUCKET", parsed.RESUME_BUCKET]] : []),
      ["JOB_SOURCE_BUCKET or RESUME_BUCKET", jobSourceBucket],
      ...(service ? [
        ["SHARED_PASSWORD", parsed.SHARED_PASSWORD],
        ["COOKIE_SIGNING_SECRET", parsed.COOKIE_SIGNING_SECRET],
      ] : []),
    ].filter((entry): entry is [string, undefined] => entry[1] === undefined);
    if (missing.length > 0) {
      throw new Error(`Missing production configuration: ${missing.map(([name]) => name).join(", ")}.`);
    }
    if (parsed.FIRESTORE_EMULATOR_HOST) {
      throw new Error("FIRESTORE_EMULATOR_HOST must not be set in production.");
    }
  }

  return {
    mode: parsed.APP_ENV,
    port: parsed.PORT,
    projectId,
    firestoreProjectId,
    location: parsed.GOOGLE_CLOUD_LOCATION,
    model: parsed.GEMINI_MODEL,
    prompts: {
      profile: parsed.PROFILE_PROMPT_VERSION,
      searchTarget: parsed.SEARCH_TARGET_PROMPT_VERSION,
      jobPosting: parsed.JOB_POSTING_PROMPT_VERSION,
    },
    storage: {
      resumeBucket: parsed.RESUME_BUCKET,
      jobSourceBucket,
    },
    corpusDirectory: resolve(parsed.JOB_CORPUS_DIR),
    auth: parsed.APP_ENV === "production" && service
      ? {
          sharedPassword: parsed.SHARED_PASSWORD as string,
          cookieSigningSecret: parsed.COOKIE_SIGNING_SECRET as string,
          sessionTtlSeconds: parsed.SESSION_TTL_SECONDS,
        }
      : undefined,
  };
}
