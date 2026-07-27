import { describe, expect, it, vi } from "vitest";

import { createCloudRunJobLauncher } from "./adapters/cloud-run-job-launcher.js";

describe("Cloud Run Job launcher", () => {
  it("uses the service identity to invoke the configured Job without elevated overrides", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "service-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "operations/run-1" }), { status: 200 }));
    const launcher = createCloudRunJobLauncher({
      projectId: "career-radar-prod",
      location: "asia-northeast3",
      jobName: "career-radar-collection",
      fetch,
    });

    await launcher.start({ runId: "queued-run" });

    expect(fetch).toHaveBeenNthCalledWith(1,
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      { headers: { "Metadata-Flavor": "Google" } },
    );
    expect(fetch).toHaveBeenNthCalledWith(2,
      "https://run.googleapis.com/v2/projects/career-radar-prod/locations/asia-northeast3/jobs/career-radar-collection:run",
      expect.objectContaining({
        method: "POST",
        headers: { authorization: "Bearer service-token", "content-type": "application/json" },
        body: "{}",
      }),
    );
  });

  it("surfaces a rejected Job invocation", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "service-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("permission denied", { status: 403 }));
    const launcher = createCloudRunJobLauncher({
      projectId: "career-radar-prod",
      location: "asia-northeast3",
      jobName: "career-radar-collection",
      fetch,
    });

    await expect(launcher.start({ runId: "queued-run" })).rejects.toThrow(
      "Cloud Run rejected the Collection Run (403): permission denied",
    );
  });
});
