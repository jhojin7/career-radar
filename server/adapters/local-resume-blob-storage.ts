import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";

import type { ResumeBlobStorage } from "../onboarding.js";

export function createLocalResumeBlobStorage(dataRoot: string): ResumeBlobStorage {
  const resumeDirectory = join(dataRoot, "resumes");

  return {
    async putResume({ bytes, fileName }) {
      await mkdir(resumeDirectory, { recursive: true });
      const extension = extname(fileName).toLowerCase() === ".pdf" ? ".pdf" : "";
      const objectName = `${randomUUID()}${extension}`;
      await writeFile(join(resumeDirectory, objectName), bytes, { flag: "wx" });
      return `local-blob://resumes/${objectName}`;
    },
  };
}
