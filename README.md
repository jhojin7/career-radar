# Career Radar

Career Radar is a locally runnable web application that turns a confirmed Candidate Profile into evidence-backed, deterministic Job Recommendations. Production persistence is designed for Firestore and Cloud Storage.

The current slice delivers PDF resume onboarding and a local Job Pool collection pipeline: a Hono HTTP Interface, a responsive React/Vite UI built with shadcn/ui and Tailwind CSS, Vertex AI Gemini extraction, immutable Candidate Profile versions in Firestore, confirmed Search Targets, TXT/PDF Job Posting normalization, revision-aware deduplication, and separate raw-source blob storage. One production process serves both the API and compiled browser assets.

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

## Local Job Pool collection

Place a prepared corpus under the ignored `data/job-postings/` directory. Each `.txt` or `.pdf` file must contain exactly one Job Posting. Other file types are ignored. To attach a stable source identity or preserve an original URL, add an optional `manifest.json` beside the files:

```json
{
  "postings": {
    "platform-engineer.txt": {
      "sourceAdapter": "manual-export",
      "sourceIdentity": "posting-123",
      "originalUrl": "https://example.com/jobs/123"
    }
  }
}
```

After confirming a Candidate Profile and three to five Search Targets, run the terminating worker against the Firestore emulator and Vertex AI:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIRESTORE_PROJECT_ID=career-radar-local \
GOOGLE_CLOUD_PROJECT=your-gcp-project \
pnpm collect
```

Set `JOB_CORPUS_DIR` to use another directory. Raw Job Posting inputs are copied to ignored `data/job-sources/` storage while normalized fields are stored in Firestore. In a deployed environment, set `JOB_SOURCE_BUCKET` (or reuse `RESUME_BUCKET`) for Cloud Storage. The tracked `fixtures/job-postings/` corpus is synthetic and can be selected with `JOB_CORPUS_DIR=fixtures/job-postings`.

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
              ├── Local TXT/PDF Job Source + Vertex AI Job Posting Extraction Adapters
              ├── Firestore Onboarding Persistence Adapter
              ├── Firestore Collection Persistence Adapter
              └── Local or Cloud Resume and Job Source Blob Storage Adapters
```

The Hono application is constructed with injected Adapters so automated tests exercise onboarding, import, deduplication, revision, counters, and partial failure without calling Vertex AI or Firestore.
