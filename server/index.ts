import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";
import { z } from "zod";

import { createFileWebAssets } from "./adapters/file-web-assets.js";
import { createApp, type Logger } from "./app.js";

const port = z.coerce.number().int().positive().parse(process.env.PORT ?? 3000);
const webRoot = fileURLToPath(new URL("../web/", import.meta.url));

const logger: Logger = {
  info: (event) => console.info(JSON.stringify(event)),
};

const app = createApp({
  logger,
  webAssets: createFileWebAssets(webRoot),
});

const server = serve({
  fetch: app.fetch,
  port,
});

console.info(`Career Radar listening on http://localhost:${port}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
