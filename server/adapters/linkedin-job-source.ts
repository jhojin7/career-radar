import type { JobSource, JobSourceDiscovery, JobSourceDocument } from "../collection.js";
import type { SearchTarget } from "../onboarding.js";

export type LinkedInJobSourceOptions = {
  maxResults: number;
  maxQueries: number;
  recencyDays: number;
  requestDelayMs: number;
  requestTimeoutMs: number;
  fetch?: typeof globalThis.fetch;
};

type LinkedInQuery = {
  target: SearchTarget;
  location: string;
};

const workModeFilter: Record<SearchTarget["workModes"][number], string> = {
  onsite: "1",
  remote: "2",
  hybrid: "3",
};

export function createLinkedInJobSource(options: LinkedInJobSourceOptions): JobSource {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const maxResults = boundedInteger(options.maxResults, 1, 10, 10);
  const maxQueries = boundedInteger(options.maxQueries, 1, 5, 5);
  const recencyDays = boundedInteger(options.recencyDays, 1, 30, 7);
  const requestDelayMs = boundedInteger(options.requestDelayMs, 500, 10_000, 1_000);
  const requestTimeoutMs = boundedInteger(options.requestTimeoutMs, 1_000, 30_000, 10_000);
  let previousRequestAt = 0;

  async function fetchText(url: URL): Promise<string> {
    const waitMs = Math.max(0, previousRequestAt + requestDelayMs - Date.now());
    if (waitMs > 0) await delay(waitMs);
    previousRequestAt = Date.now();

    const response = await fetchImpl(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "CareerRadar/0.1 (personal best-effort public Job Posting collection)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    if (!response.ok) {
      throw new LinkedInRequestError(
        `LinkedIn returned HTTP ${response.status} for ${url.pathname}`,
        response.status === 429,
      );
    }
    return response.text();
  }

  return {
    async discover({ searchTargets }) {
      const discovery: JobSourceDiscovery = { documents: [], errors: [] };
      const postingIds = new Set<string>();
      const queries = buildQueries(searchTargets.searchTargets, maxQueries);

      for (const { target, location } of queries) {
        const url = createSearchUrl(target, location, recencyDays);
        try {
          const html = await fetchText(url);
          for (const postingId of extractPostingIds(html)) {
            postingIds.add(postingId);
            if (postingIds.size >= maxResults) break;
          }
        } catch (error) {
          discovery.errors.push({
            sourceKey: `linkedin:${target.id}:${location}`,
            message: errorMessage(error),
          });
          if (isRateLimited(error)) break;
        }
        if (postingIds.size >= maxResults) break;
      }

      for (const postingId of postingIds) {
        try {
          const detailUrl = new URL(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${postingId}`);
          const html = await fetchText(detailUrl);
          discovery.documents.push(toJobSourceDocument(postingId, html));
        } catch (error) {
          discovery.errors.push({ sourceKey: `linkedin:${postingId}`, message: errorMessage(error) });
          if (isRateLimited(error)) break;
        }
      }

      return discovery;
    },
  };
}

function buildQueries(searchTargets: SearchTarget[], maxQueries: number): LinkedInQuery[] {
  const primary = searchTargets.map((target) => ({ target, location: target.locations[0] ?? "" }));
  const additional = searchTargets.flatMap((target) =>
    target.locations.slice(1).map((location) => ({ target, location })),
  );
  return [...primary, ...additional].filter(({ location }) => location.length > 0).slice(0, maxQueries);
}

function createSearchUrl(target: SearchTarget, location: string, recencyDays: number): URL {
  const url = new URL("https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search");
  url.searchParams.set("keywords", target.title);
  url.searchParams.set("location", location);
  url.searchParams.set("f_TPR", `r${recencyDays * 24 * 60 * 60}`);
  url.searchParams.set("f_WT", target.workModes.map((mode) => workModeFilter[mode]).join(","));
  url.searchParams.set("start", "0");
  return url;
}

function extractPostingIds(html: string): string[] {
  const ids: string[] = [];
  const patterns = [
    /data-entity-urn=["']urn:li:jobPosting:(\d+)["']/g,
    /\/jobs\/view\/(?:[^?"'\s/]*-)?(\d+)(?:[?"'\s/]|$)/g,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const postingId = match[1];
      if (postingId && !ids.includes(postingId)) ids.push(postingId);
    }
  }
  return ids;
}

function toJobSourceDocument(postingId: string, html: string): JobSourceDocument {
  const originalUrl = `https://www.linkedin.com/jobs/view/${postingId}`;
  const text = htmlToText(html);
  return {
    sourceKey: `linkedin:${postingId}`,
    fileName: `linkedin-${postingId}.txt`,
    mediaType: "text/plain",
    bytes: new TextEncoder().encode(`Original URL: ${originalUrl}\n\n${text}`),
    sourceAdapter: "linkedin-public",
    sourceIdentity: postingId,
    originalUrl,
  };
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:div|h[1-6]|li|p|section|ul)>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return named[code.toLowerCase()] ?? entity;
  });
}

class LinkedInRequestError extends Error {
  constructor(message: string, readonly rateLimited: boolean) {
    super(message);
  }
}

function isRateLimited(error: unknown): boolean {
  return error instanceof LinkedInRequestError && error.rateLimited;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "TimeoutError") return "LinkedIn request timed out";
  return error instanceof Error ? error.message : "Unknown LinkedIn collection error";
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function boundedInteger(value: number, minimum: number, maximum: number, fallback: number): number {
  return Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.trunc(value)))
    : fallback;
}
