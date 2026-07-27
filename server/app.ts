import { Hono } from "hono";
import { z } from "zod";

const HealthResponse = z.object({
  status: z.literal("ok"),
});

export type Logger = {
  info: (event: {
    method: string;
    path: string;
    status: number;
    durationMs: number;
  }) => void;
};

export type AppDependencies = {
  logger: Logger;
  webAssets?: WebAssets;
};

export type WebAssets = {
  get: (path: string) => Promise<Response | null>;
};

export function createApp({ logger, webAssets }: AppDependencies): Hono {
  const app = new Hono();

  app.use("*", async (context, next) => {
    const startedAt = performance.now();

    await next();

    logger.info({
      method: context.req.method,
      path: context.req.path,
      status: context.res.status,
      durationMs: Math.round(performance.now() - startedAt),
    });
  });

  app.get("/api/healthz", (context) => {
    return context.json(HealthResponse.parse({ status: "ok" }));
  });

  if (webAssets) {
    app.get("*", async (context) => {
      if (context.req.path.startsWith("/api/")) {
        return context.notFound();
      }

      const requestedPath = context.req.path === "/" ? "/index.html" : context.req.path;
      const asset = await webAssets.get(requestedPath);

      if (asset) {
        return asset;
      }

      if (requestedPath.includes(".")) {
        return context.notFound();
      }

      return (await webAssets.get("/index.html")) ?? context.notFound();
    });
  }

  return app;
}
