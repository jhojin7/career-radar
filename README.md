# Career Radar

Career Radar is a GCP-based AI job-search demo for the NIPA Google Study Jam PBL.
It will ingest a job posting, normalize it into one shared schema, compare it with a
candidate profile, rank it deterministically, and generate an application brief.

This repository begins with the first vertical slice from
[AS-103](https://linear.app/rumble-freezing-struggle/issue/AS-103): a local,
cloud-independent `Job` model and source-adapter contract. The setup work is tracked in
[AS-104](https://linear.app/rumble-freezing-struggle/issue/AS-104).

## Quick start

Prerequisites: Python 3.12+ and [uv](https://docs.astral.sh/uv/).

```bash
uv sync
uv run career-radar sample-job
uv run pytest
```

The sample command intentionally works without Google Cloud credentials. Cloud-aware
commands validate their configuration explicitly:

```bash
cp .env.example .env
# Set GCP_PROJECT_ID in .env.
uv run career-radar check-config
```

## GCP bootstrap

After choosing the GCP project, authenticate with `gcloud` and run:

```bash
GCP_PROJECT_ID=your-project-id scripts/bootstrap-gcp.sh
```

The script confirms the target project before enabling Cloud Run, Vertex AI, BigQuery,
Cloud Storage, Cloud Scheduler, Secret Manager, Artifact Registry, and Cloud Build APIs.
It does not create billable resources or store secret values.

## Project layout

```text
src/career_radar/
  cli.py              Local developer commands
  config.py           Validated environment configuration
  domain/job.py       Shared Job schema
  sources/base.py     JobSource adapter contract
scripts/
  bootstrap-gcp.sh    Guarded API-enablement helper
tests/                Schema and configuration tests
```

## Build order

1. Manual job-text input and deterministic validation/scoring.
2. Normalization, deduplication, and persistence.
3. Gemini extraction, rank engine, and application brief.
4. Mobile happy path.
5. Cloud Run deployment and scheduled collection.
