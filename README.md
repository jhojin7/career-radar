# Career Radar

Career Radar is a locally runnable web application that turns a confirmed Candidate Profile into evidence-backed, deterministic Job Recommendations. Production persistence is designed for Firestore and Cloud Storage.

This repository currently contains the TypeScript application shell: a Hono HTTP Interface, a responsive React/Vite UI built with shadcn/ui and Tailwind CSS, and one production process that serves both the API and compiled browser assets.

The canonical product specification is [GitHub Issue #1](https://github.com/jhojin7/career-radar/issues/1).

## Prerequisites

- Node.js 22 or newer
- pnpm 10

## Local development

```bash
pnpm install
pnpm dev
```

Open <http://localhost:5173>. Vite serves the browser UI and proxies `/api` requests to Hono on port 3000.

## Production-mode local run

```bash
pnpm build
pnpm start
```

Open <http://localhost:3000>. Hono serves the compiled React application and the health operation at `/api/healthz`.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Application shape

```text
Browser
  └── React + Vite + shadcn/ui
        └── Hono HTTP Interface
              └── injected external Adapters (added by later slices)
```

The Hono application is constructed with injected Adapters so automated tests can exercise its public HTTP behavior without creating production clients.
