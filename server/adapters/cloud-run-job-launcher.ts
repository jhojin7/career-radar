import type { CollectionRunLauncher } from "../collection-run-launcher.js";

const metadataTokenUrl =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

export function createCloudRunJobLauncher(options: {
  projectId: string;
  location: string;
  jobName: string;
  fetch?: typeof fetch;
}): CollectionRunLauncher {
  const fetchImplementation = options.fetch ?? fetch;
  return {
    async start() {
      const tokenResponse = await fetchImplementation(metadataTokenUrl, {
        headers: { "Metadata-Flavor": "Google" },
      });
      if (!tokenResponse.ok) {
        throw new Error(`Could not obtain the Cloud Run service identity token (${tokenResponse.status}).`);
      }
      const token = await tokenResponse.json() as { access_token?: unknown };
      if (typeof token.access_token !== "string" || token.access_token.length === 0) {
        throw new Error("The Cloud Run service identity returned an invalid access token.");
      }

      const job = [options.projectId, options.location, options.jobName].map(encodeURIComponent);
      const runResponse = await fetchImplementation(
        `https://run.googleapis.com/v2/projects/${job[0]}/locations/${job[1]}/jobs/${job[2]}:run`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token.access_token}`,
            "content-type": "application/json",
          },
          body: "{}",
        },
      );
      if (!runResponse.ok) {
        const detail = (await runResponse.text()).slice(0, 500);
        throw new Error(`Cloud Run rejected the Collection Run (${runResponse.status}): ${detail || runResponse.statusText}`);
      }
    },
  };
}
