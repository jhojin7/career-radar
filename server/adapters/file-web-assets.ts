import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

import type { WebAssets } from "../app.js";

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export function createFileWebAssets(root: string): WebAssets {
  const rootPath = resolve(root);

  return {
    async get(assetPath) {
      const filePath = resolve(rootPath, `.${assetPath}`);
      if (filePath !== rootPath && !filePath.startsWith(`${rootPath}${sep}`)) {
        return null;
      }

      try {
        const content = await readFile(filePath);
        const contentType = contentTypes[extname(filePath)] ?? "application/octet-stream";

        return new Response(new Uint8Array(content), {
          headers: { "content-type": contentType },
        });
      } catch (error) {
        if (isMissingFile(error)) {
          return null;
        }

        throw error;
      }
    },
  };
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
