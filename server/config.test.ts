import { describe, expect, it } from "vitest";

import { loadRuntimeConfig } from "./config.js";

describe("runtime configuration", () => {
  it("keeps local adapters and authentication disabled by default", () => {
    const config = loadRuntimeConfig({
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIRESTORE_PROJECT_ID: "career-radar-local",
      GOOGLE_CLOUD_PROJECT: "vertex-project",
    });

    expect(config).toMatchObject({
      mode: "local",
      projectId: "vertex-project",
      firestoreProjectId: "career-radar-local",
      storage: { resumeBucket: undefined, jobSourceBucket: undefined },
      auth: undefined,
    });
  });

  it("validates and exposes deployed configuration", () => {
    const config = loadRuntimeConfig({
      APP_ENV: "production",
      GOOGLE_CLOUD_PROJECT: "career-radar-prod",
      GOOGLE_CLOUD_LOCATION: "asia-northeast3",
      CLOUD_RUN_JOB_NAME: "career-radar-collection",
      CLOUD_RUN_JOB_LOCATION: "asia-northeast3",
      GEMINI_MODEL: "gemini-model",
      PROFILE_PROMPT_VERSION: "profile-v2",
      SEARCH_TARGET_PROMPT_VERSION: "targets-v2",
      JOB_POSTING_PROMPT_VERSION: "posting-v2",
      RESUME_BUCKET: "career-radar-sources",
      SHARED_PASSWORD: "shared-password",
      COOKIE_SIGNING_SECRET: "01234567890123456789012345678901",
    });

    expect(config).toMatchObject({
      mode: "production",
      projectId: "career-radar-prod",
      firestoreProjectId: "career-radar-prod",
      location: "asia-northeast3",
      collectionJob: { name: "career-radar-collection", location: "asia-northeast3" },
      model: "gemini-model",
      prompts: { profile: "profile-v2", searchTarget: "targets-v2", jobPosting: "posting-v2" },
      storage: { resumeBucket: "career-radar-sources", jobSourceBucket: "career-radar-sources" },
      auth: { sharedPassword: "shared-password", sessionTtlSeconds: 43_200 },
    });
  });

  it("fails fast when deployed configuration is incomplete", () => {
    expect(() => loadRuntimeConfig({ APP_ENV: "production" })).toThrowError(
      "Missing production configuration: GOOGLE_CLOUD_PROJECT, RESUME_BUCKET, JOB_SOURCE_BUCKET or RESUME_BUCKET, CLOUD_RUN_JOB_NAME, CLOUD_RUN_JOB_LOCATION, SHARED_PASSWORD, COOKIE_SIGNING_SECRET.",
    );
  });

  it("rejects a production emulator connection", () => {
    expect(() => loadRuntimeConfig({
      APP_ENV: "production",
      GOOGLE_CLOUD_PROJECT: "career-radar-prod",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      RESUME_BUCKET: "career-radar-sources",
      CLOUD_RUN_JOB_NAME: "career-radar-collection",
      CLOUD_RUN_JOB_LOCATION: "asia-northeast3",
      SHARED_PASSWORD: "shared-password",
      COOKIE_SIGNING_SECRET: "01234567890123456789012345678901",
    })).toThrowError("FIRESTORE_EMULATOR_HOST must not be set in production.");
  });

  it("does not require service-only secrets for the terminating worker", () => {
    const config = loadRuntimeConfig({
      APP_ENV: "production",
      GOOGLE_CLOUD_PROJECT: "career-radar-prod",
      JOB_SOURCE_BUCKET: "career-radar-job-sources",
    }, { service: false });

    expect(config.auth).toBeUndefined();
    expect(config.storage.jobSourceBucket).toBe("career-radar-job-sources");
  });
});
