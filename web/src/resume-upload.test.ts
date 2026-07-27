import { describe, expect, it } from "vitest";

import { isSupportedResumeMetadata } from "./resume-upload.js";

describe("resume upload metadata", () => {
  it("accepts supported PDF MIME variants and rejects mismatched files", () => {
    expect([
      isSupportedResumeMetadata({ name: "resume.pdf", type: "application/pdf" }),
      isSupportedResumeMetadata({ name: "RESUME.PDF", type: "" }),
      isSupportedResumeMetadata({ name: "resume.pdf", type: "application/octet-stream" }),
      isSupportedResumeMetadata({ name: "resume.txt", type: "application/pdf" }),
      isSupportedResumeMetadata({ name: "resume.pdf", type: "text/plain" }),
    ]).toEqual([true, true, true, false, false]);
  });
});
