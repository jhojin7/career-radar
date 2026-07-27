# Career Radar

Career Radar is a locally runnable web application that turns a confirmed Candidate Profile into evidence-backed, deterministic Job Recommendations. Production persistence is designed for Firestore and Cloud Storage.

The current slice delivers PDF resume onboarding: a Hono HTTP Interface, a responsive React/Vite UI built with shadcn/ui and Tailwind CSS, Vertex AI Gemini extraction, immutable Candidate Profile versions in Firestore, editable Search Target suggestions, confirmed Search Targets, and local resume blob storage. One production process serves both the API and compiled browser assets.

The canonical product specification is [GitHub Issue #1](https://github.com/jhojin7/career-radar/issues/1).

## Prerequisites

- Node.js 22 or newer
- pnpm 10
- Google Cloud CLI with a project that has Vertex AI enabled
- A local Firestore emulator

## Local development

Authenticate Application Default Credentials once and start the Firestore emulator in a separate terminal:

```bash
gcloud auth application-default login
gcloud emulators firestore start --host-port=127.0.0.1:8080
```

Then install and run Career Radar. `GOOGLE_CLOUD_PROJECT` is the real Vertex AI project; the separate emulator project ID keeps local structured data isolated.

```bash
pnpm install
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIRESTORE_PROJECT_ID=career-radar-local \
GOOGLE_CLOUD_PROJECT=your-gcp-project \
pnpm dev
```

Open <http://localhost:5173>. Vite serves the browser UI and proxies `/api` requests to Hono on port 3000.

Optional configuration:

- `GOOGLE_CLOUD_LOCATION` defaults to `global`.
- `GEMINI_MODEL` defaults to `gemini-2.5-flash`.
- Resume PDFs are written under ignored `data/resumes/` local blob storage.
- Set `RESUME_BUCKET` in a deployed environment to store resume PDFs in Cloud Storage. Production and Cloud Run startup fail fast when it is missing.

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
              ├── Vertex AI Profile Extraction Adapter (Google Gen AI SDK + ADC)
              ├── Firestore Onboarding Persistence Adapter
              └── Local or Cloud Resume Blob Storage Adapter
```

The Hono application is constructed with injected Adapters so automated tests exercise validation, editing, confirmation, and Search Target behavior without calling Vertex AI or Firestore.
