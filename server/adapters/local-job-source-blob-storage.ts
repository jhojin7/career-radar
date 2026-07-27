import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

import type { JobSourceBlobStorage } from "../collection.js";

export function createLocalJobSourceBlobStorage(dataRoot: string): JobSourceBlobStorage {
  const sourceDirectory = join(dataRoot, "job-sources");
  return {
    async putJobSource({ bytes, fileName, contentHash }) {
      await mkdir(sourceDirectory, { recursive: true });
      const extension = [".txt", ".pdf"].includes(extname(fileName).toLowerCase())
        ? extname(fileName).toLowerCase()
        : "";
      const objectName = `${contentHash}${extension}`;
      const target = join(sourceDirectory, objectName);
      try {
        await access(target, constants.F_OK);
      } catch {
        await writeFile(target, bytes, { flag: "wx" });
      }
      return `local-blob://job-sources/${objectName}`;
    },
  };
}
