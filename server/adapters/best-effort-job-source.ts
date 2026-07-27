import type { JobSource, JobSourceDiscovery } from "../collection.js";

export type NamedJobSource = {
  sourceKey: string;
  source: JobSource;
};

export function createBestEffortJobSource(sources: NamedJobSource[]): JobSource {
  return {
    async discover(input) {
      const discoveries = await Promise.all(sources.map(async ({ sourceKey, source }): Promise<JobSourceDiscovery> => {
        try {
          return await source.discover(input);
        } catch (error) {
          return {
            documents: [],
            errors: [{
              sourceKey,
              message: error instanceof Error ? error.message : "Unknown Job Posting source error",
            }],
          };
        }
      }));

      return {
        documents: discoveries.flatMap(({ documents }) => documents),
        errors: discoveries.flatMap(({ errors }) => errors),
      };
    },
  };
}
