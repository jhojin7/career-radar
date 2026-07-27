# Scheduled Collection Run verification

Use this check after deploying with `scripts/deploy-cloud-run.sh`. It exercises real Cloud Run, Firestore, Cloud Storage, Vertex AI, and Cloud Scheduler resources and must not run in CI.

## On-demand execution

1. Open the deployed service, sign in, and confirm a Candidate Profile and three to five Search Targets.
2. In **Job Pool**, select **Run collection**.
3. Confirm the request returns immediately and the latest Collection Run changes from `queued` to `running` without keeping the browser request open.
4. Keep the page open and confirm polling eventually shows `completed` or `completed-with-errors`, updated counters, and partial Job Recommendations when an individual posting fails.
5. While a run is queued or running, try starting another run. Confirm the button is disabled; also verify a direct second `POST /api/collection-runs` receives `409 collection_run_active`.

Inspect the matching `collectionRuns/{runId}` Firestore document and confirm the state and counters match the UI. Confirm `collectionControl/activeRun` is removed after a terminal state.

## Scheduled execution

Force the configured scheduler job instead of waiting for its cron window:

```bash
gcloud scheduler jobs run career-radar-collection \
  --location "$REGION" \
  --project "$PROJECT_ID"
```

Confirm one new Cloud Run Job execution appears and one new `collectionRuns` document progresses from `running` to a terminal state. Refresh the UI and confirm it displays that same persisted run and its Job Recommendations.

## Identity boundaries

Confirm the web service and scheduler service accounts have `roles/run.invoker` only on the Collection Job. Confirm the Collection Job service account has the required Firestore, Vertex AI, and source-bucket roles and does not have Secret Manager access. The deployment script grants these bindings explicitly.

