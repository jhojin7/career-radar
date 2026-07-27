import {
  CollectionRunSchema,
  runCollection,
  type CollectionDependencies,
  type CollectionPersistence,
} from "./collection.js";

export type CollectionRunLauncher = {
  start: (input: { runId: string }) => Promise<void>;
};

export function createInProcessCollectionRunLauncher(
  dependencies: CollectionDependencies,
  logError: (event: { event: string; runId: string; message: string }) => void,
): CollectionRunLauncher {
  return {
    async start({ runId }) {
      setImmediate(() => {
        void runCollection({ ...dependencies, runId }).catch(async (error: unknown) => {
          const message = errorMessage(error);
          await failQueuedRun(dependencies.persistence, runId, message, dependencies.clock).catch(() => undefined);
          logError({ event: "collection_run_crashed", runId, message });
        });
      });
    },
  };
}

export async function failQueuedRun(
  persistence: CollectionPersistence,
  runId: string,
  message: string,
  clock: () => Date = () => new Date(),
): Promise<void> {
  const run = await persistence.getRun(runId);
  if (!run || (run.status !== "queued" && run.status !== "running")) return;
  await persistence.updateRun(CollectionRunSchema.parse({
    ...run,
    status: "failed",
    counts: { ...run.counts, failed: run.counts.failed + 1 },
    errors: [...run.errors, { sourceKey: "collection-run", message }],
    completedAt: clock().toISOString(),
  }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown collection error";
}
