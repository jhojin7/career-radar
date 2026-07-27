# Manual verification: low-volume LinkedIn collection

This check is deliberately manual. Automated LinkedIn requests, recorded LinkedIn responses, and CI network calls are not part of the test suite.

## Prerequisites

- A locally confirmed Candidate Profile and three to five confirmed Search Targets
- A running Firestore emulator containing that onboarding state
- Google Cloud credentials and a project that can call the configured Gemini model

## Run

Use limits below the built-in defaults so the check stays low volume:

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIRESTORE_PROJECT_ID=career-radar-local \
GOOGLE_CLOUD_PROJECT=your-gcp-project \
LINKEDIN_COLLECTION_ENABLED=true \
LINKEDIN_MAX_RESULTS=3 \
LINKEDIN_MAX_QUERIES=3 \
LINKEDIN_RECENCY_DAYS=7 \
LINKEDIN_REQUEST_DELAY_MS=1500 \
pnpm collect
```

Confirm from the emitted `collection_run_completed` event and the browser UI that:

1. At most three LinkedIn Job Postings were discovered.
2. LinkedIn documents use `linkedin-public` as their source adapter and retain an original `linkedin.com/jobs/view/...` URL.
3. A discovered Job Posting entered the Job Pool and can be opened as a Job Recommendation after normal extraction and ranking.
4. Repeating the command treats unchanged Job Postings as duplicates and does not create extra Job Pool entries.
5. Disabling LinkedIn by removing `LINKEDIN_COLLECTION_ENABLED` leaves local collection usable.
6. If LinkedIn returns an error or HTTP 429, the Collection Run records a `linkedin:` diagnostic and keeps any local-source results.

Record the date, final Collection Run status and counts, and whether LinkedIn returned results or a diagnostic with the deployment notes for the environment being verified. Do not commit LinkedIn response bodies as fixtures.

## Verification record

On 2026-07-27, a local in-memory Collection Run queried one confirmed `Platform Engineer` / `Seoul` / `hybrid` Search Target with a seven-day recency window, `maxQueries=1`, and `maxResults=1`. The live public source returned one document and the shared Collection Run completed with:

```json
{
  "status": "completed",
  "counts": {
    "discovered": 1,
    "new": 1,
    "revised": 0,
    "duplicate": 0,
    "normalized": 1,
    "reviewRequired": 1,
    "failed": 0
  },
  "errors": []
}
```

The persisted Job Posting had source adapter `linkedin-public`, revision `1`, and a stable `https://www.linkedin.com/jobs/view/...` original URL. The check used in-memory persistence and a manual extraction stub to exercise the production Collection Run without writing the fetched response to a fixture or making LinkedIn part of automated tests.
