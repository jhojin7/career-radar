import {serve} from "@hono/node-server";

import {createApp, type Logger} from "../server/app.js";
import type {
  CollectionPersistence,
  CollectionRun,
  JobPosting,
} from "../server/collection.js";
import type {
  CandidateProfile,
  OnboardingPersistence,
  SearchTargetSet,
} from "../server/onboarding.js";

const now = "2026-07-29T09:30:00.000Z";
const logger: Logger = {info: () => undefined};

const candidateProfile: CandidateProfile = {
  id: "presentation-profile",
  version: 3,
  draftId: "presentation-draft",
  status: "active",
  confirmedAt: now,
  profile: {
    fullName: "Synthetic Candidate",
    email: "",
    phone: "",
    headline: "Platform Engineer",
    summary: "Builds reliable TypeScript developer platforms on Google Cloud.",
    experience: [
      {
        id: "experience-1",
        employer: "Synthetic Systems",
        role: "Software Engineer",
        startDate: "2020-01-01",
        endDate: "2024-12-31",
        summary: "Built platform services and internal developer tooling.",
        evidence: [{quote: "Software Engineer, 2020–2024", page: 1}],
      },
    ],
    education: [],
    skills: [
      {name: "TypeScript", evidence: [{quote: "TypeScript", page: 1}]},
      {name: "GCP", evidence: [{quote: "Google Cloud Platform", page: 1}]},
      {name: "React", evidence: [{quote: "React", page: 1}]},
    ],
    projects: [],
    uncertainties: [],
    careerGoals: ["Build developer platforms", "Improve developer experience"],
    preferredLocations: ["Seoul"],
    workModes: ["hybrid", "remote"],
    disqualifyingConditions: [
      {
        id: "employment-type",
        type: "employment-type",
        description: "Exclude contract roles",
      },
    ],
    fitWeights: {
      technical: 40,
      experience: 25,
      careerDirection: 25,
      workConditions: 10,
    },
  },
};

const searchTargets: SearchTargetSet = {
  profileId: candidateProfile.id,
  searchTargets: [
    {id: "target-1", title: "Platform Engineer", locations: ["Seoul"], workModes: ["hybrid"]},
    {id: "target-2", title: "Developer Experience Engineer", locations: ["Korea"], workModes: ["remote"]},
    {id: "target-3", title: "Cloud Engineer", locations: ["Seoul"], workModes: ["hybrid"]},
  ],
  updatedAt: now,
  confirmedAt: now,
};

const postings: JobPosting[] = [
  posting("platform", {
    title: "Platform Engineer",
    companyName: "Synthetic Cloud",
    summary: "Build developer platform services using TypeScript on Google Cloud.",
    requiredSkills: ["TypeScript"],
    preferredSkills: ["GCP"],
    responsibilities: ["Build developer platform services", "Improve developer feedback loops"],
    workModes: ["hybrid"],
    experience: {minYears: 3, maxYears: 5, rawText: "3–5 years"},
    evidence: [
      {field: "requiredSkills", quote: "TypeScript is required"},
      {field: "preferredSkills", quote: "Google Cloud experience is preferred"},
      {field: "experience", quote: "3–5 years of software engineering experience"},
      {field: "responsibilities", quote: "Build developer platform services"},
      {field: "locations", quote: "Seoul"},
      {field: "workModes", quote: "Hybrid work"},
    ],
  }),
  posting("devex", {
    title: "Developer Experience Engineer",
    companyName: "Orbit Systems",
    summary: "Improve internal tooling and developer feedback loops with React and TypeScript.",
    requiredSkills: ["TypeScript", "React"],
    preferredSkills: ["GCP"],
    responsibilities: ["Improve developer experience", "Build internal tools"],
    workModes: ["remote"],
    experience: {minYears: 4, maxYears: null, rawText: "4+ years"},
    evidence: [
      {field: "requiredSkills", quote: "Strong TypeScript and React experience"},
      {field: "responsibilities", quote: "Improve developer experience across engineering"},
      {field: "workModes", quote: "Remote within Korea"},
    ],
  }),
  posting("review", {
    title: "Cloud Infrastructure Engineer",
    companyName: "Northstar Labs",
    summary: "Operate cloud infrastructure for a growing platform team.",
    requiredSkills: ["GCP"],
    preferredSkills: ["Kubernetes"],
    responsibilities: ["Operate production infrastructure"],
    workModes: [],
    reviewRequired: true,
    evidence: [
      {field: "requiredSkills", quote: "Hands-on Google Cloud experience"},
      {field: "workModes", quote: "Work arrangement discussed during interviews"},
    ],
  }),
  posting("contract", {
    title: "Backend Platform Engineer",
    companyName: "Morrow Technologies",
    summary: "Six-month contract building backend platform services.",
    employmentTypes: ["contract"],
    requiredSkills: ["TypeScript"],
    preferredSkills: [],
    responsibilities: ["Build backend platform services"],
    workModes: ["onsite"],
    evidence: [
      {field: "employmentTypes", quote: "Six-month contract"},
      {field: "requiredSkills", quote: "TypeScript backend experience"},
      {field: "workModes", quote: "Onsite in Seoul"},
    ],
  }),
];

const latestRun: CollectionRun = {
  id: "presentation-run",
  status: "completed",
  profileId: candidateProfile.id,
  profileVersion: candidateProfile.version,
  searchTargetCount: searchTargets.searchTargets.length,
  counts: {
    discovered: 6,
    new: 4,
    revised: 0,
    duplicate: 2,
    normalized: 4,
    reviewRequired: 1,
    failed: 0,
  },
  errors: [],
  startedAt: "2026-07-29T09:29:47.000Z",
  completedAt: now,
};

const onboardingPersistence = {
  getDraft: async () => null,
  getActiveProfile: async () => structuredClone(candidateProfile),
  getSearchTargetDraft: async () => null,
  getSearchTargets: async () => structuredClone(searchTargets),
} as unknown as OnboardingPersistence;

const collectionPersistence = {
  getLatestRun: async () => structuredClone(latestRun),
  getJobPoolSummary: async () => ({
    activePostings: postings.length,
    reviewRequired: postings.filter((item) => item.reviewRequired).length,
    totalRevisions: postings.reduce((total, item) => total + item.revision, 0),
    lastUpdatedAt: latestRun.completedAt,
  }),
  getJobPostings: async () => structuredClone(postings),
} as unknown as CollectionPersistence;

const app = createApp({
  logger,
  onboardingPersistence,
  collectionPersistence,
});

const server = serve({fetch: app.fetch, port: 3000});
console.info("Career Radar presentation fixture API listening on http://127.0.0.1:3000");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

function posting(id: string, overrides: Partial<JobPosting>): JobPosting {
  return {
    id: `presentation-${id}`,
    revision: 1,
    title: "Platform Engineer",
    companyName: "Synthetic Employer",
    summary: "Build platform services.",
    employmentTypes: ["full-time"],
    locations: ["Seoul"],
    workModes: ["hybrid"],
    experience: {minYears: 3, maxYears: null, rawText: "3+ years"},
    requiredSkills: ["TypeScript"],
    preferredSkills: [],
    responsibilities: ["Build platform services"],
    closingAt: "2026-08-31T00:00:00.000Z",
    evidence: [{field: "requiredSkills", quote: "TypeScript"}],
    reviewRequired: false,
    source: {
      adapter: "presentation-fixture",
      identity: id,
      fileName: `${id}.txt`,
      originalUrl: `https://example.com/jobs/${id}`,
      rawSourceRef: `memory://${id}`,
    },
    contentHash: id.padEnd(64, "a").slice(0, 64),
    processingState: "normalized",
    extraction: {model: "presentation-fixture", promptVersion: "presentation-v1"},
    ingestedAt: now,
    ...overrides,
  };
}
