import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import {
  ProfileDataSchema,
  SearchTargetSuggestionSchema,
  type ProfileExtraction,
} from "../onboarding.js";

const PROFILE_PROMPT_VERSION = "profile-v1";
const SEARCH_TARGET_PROMPT_VERSION = "search-target-v1";
const SearchTargetSuggestionsSchema = z.object({
  suggestions: z.array(SearchTargetSuggestionSchema.omit({ id: true })).min(3).max(5),
});

type VertexProfileExtractionOptions = {
  project?: string;
  location?: string;
  model?: string;
  idGenerator?: () => string;
};

export function createVertexAiProfileExtraction({
  project,
  location = "global",
  model = "gemini-2.5-flash",
  idGenerator = () => crypto.randomUUID(),
}: VertexProfileExtractionOptions): ProfileExtraction {
  let ai: GoogleGenAI | undefined;
  const client = () => {
    if (!project) {
      throw new Error("Set GOOGLE_CLOUD_PROJECT before using Gemini resume extraction.");
    }
    ai ??= new GoogleGenAI({ vertexai: true, project, location, apiVersion: "v1" });
    return ai;
  };

  return {
    async extractProfile({ bytes }) {
      const response = await client().models.generateContent({
        model,
        contents: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: Buffer.from(bytes).toString("base64"),
            },
          },
          {
            text: [
              "Extract a Profile Draft from this text-extractable resume PDF.",
              "Keep facts faithful to the source. Include short verbatim evidence quotes and page numbers when known.",
              "Record gaps or ambiguous claims in uncertainties instead of inventing values.",
              "Career goals, location preferences, work modes, Disqualifying Conditions, and Fit Weights are user inputs:",
              "return empty arrays for those preference fields and the default weights 40/25/25/10.",
            ].join(" "),
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(ProfileDataSchema),
          temperature: 0,
        },
      });
      const responseText = response.text;
      if (!responseText) throw new Error("Gemini returned an empty Profile Draft.");

      return {
        profile: ProfileDataSchema.parse(JSON.parse(responseText)),
        model: response.modelVersion ?? model,
        promptVersion: PROFILE_PROMPT_VERSION,
      };
    },

    async suggestSearchTargets(candidateProfile) {
      const response = await client().models.generateContent({
        model,
        contents: [
          `Produce three to five Search Target suggestions from this confirmed Candidate Profile. ` +
            `Each suggestion needs a role title plus explicit geographic and work-mode scope. ` +
            `The suggestions guide discovery only and must not be described as ranking criteria. ` +
            `Candidate Profile: ${JSON.stringify(candidateProfile.profile)}`,
        ],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(SearchTargetSuggestionsSchema),
          temperature: 0.2,
        },
      });
      const responseText = response.text;
      if (!responseText) throw new Error(`Gemini returned no Search Target suggestions (${SEARCH_TARGET_PROMPT_VERSION}).`);
      const parsed = SearchTargetSuggestionsSchema.parse(JSON.parse(responseText));
      return parsed.suggestions.map((suggestion) => ({ ...suggestion, id: idGenerator() }));
    },
  };
}
