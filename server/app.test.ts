import { describe, expect, it } from "vitest";

import { createApp, type Logger } from "./app.js";

const silentLogger: Logger = {
  info: () => undefined,
};

describe("Career Radar HTTP interface", () => {
  it("reports that the application is healthy", async () => {
    const app = createApp({ logger: silentLogger });

    const response = await app.request("/api/healthz");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("serves the browser shell through an injected web asset adapter", async () => {
    const app = createApp({
      logger: silentLogger,
      webAssets: {
        get: async (path) => {
          if (path !== "/index.html") {
            return null;
          }

          return new Response("<main>Career Radar</main>", {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        },
      },
    });

    const response = await app.request("/");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    await expect(response.text()).resolves.toBe("<main>Career Radar</main>");
  });
});
