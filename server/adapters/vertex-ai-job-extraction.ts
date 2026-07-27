import { GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";

import { JobPostingExtractionSchema, type JobPostingExtractionAdapter } from "../collection.js";

const PROMPT_VERSION = "job-posting-v1";

type VertexJobExtractionOptions = {
  project?: string;
  location?: string;
  model?: string;
};

export function createVertexAiJobExtraction({
  project,
  location = "global",
  model = "gemini-2.5-flash",
}: VertexJobExtractionOptions): JobPostingExtractionAdapter {
  let ai: GoogleGenAI | undefined;
  const client = () => {
    if (!project) throw new Error("Set GOOGLE_CLOUD_PROJECT before using Gemini Job Posting extraction.");
    ai ??= new GoogleGenAI({ vertexai: true, project, location, apiVersion: "v1" });
    return ai;
  };

  return {
    async extractJobPosting({ source, candidateProfile, searchTargets }) {
      const sourceContent: Part = source.mediaType === "application/pdf"
        ? { inlineData: { mimeType: source.mediaType, data: Buffer.from(source.bytes).toString("base64") } }
        : { text: new TextDecoder().decode(source.bytes) };
      const response = await client().models.generateContent({
        model,
        contents: [
          sourceContent,
          {
            text: [
              "Normalize this single source file as exactly one Job Posting.",
              "Extract only facts supported by the source and attach short verbatim evidence quotes to important fields.",
              "Use null or empty arrays for absent facts. Mark reviewRequired when a potentially disqualifying fact is ambiguous.",
              "Do not score, rank, or adapt facts to the Candidate Profile or Search Targets.",
              `Collection context: Candidate Profile ${candidateProfile.id} version ${candidateProfile.version};`,
              `Search Targets: ${searchTargets.searchTargets.map((target) => target.title).join(", ")}.`,
            ].join(" "),
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(JobPostingExtractionSchema),
          temperature: 0,
        },
      });
      if (!response.text) throw new Error("Gemini returned an empty Job Posting extraction.");
      return {
        posting: JobPostingExtractionSchema.parse(JSON.parse(response.text)),
        model: response.modelVersion ?? model,
        promptVersion: PROMPT_VERSION,
      };
    },
  };
}
