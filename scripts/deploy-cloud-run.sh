#!/usr/bin/env bash
set -euo pipefail

required=(PROJECT_ID REGION RESUME_BUCKET SHARED_PASSWORD_SECRET COOKIE_SIGNING_SECRET)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Set ${name} before running this script." >&2
    exit 1
  fi
done

SERVICE_NAME="${SERVICE_NAME:-career-radar}"
SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-career-radar-runtime}"
ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-career-radar}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
FIRESTORE_LOCATION="${FIRESTORE_LOCATION:-${REGION}}"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-flash}"
PROFILE_PROMPT_VERSION="${PROFILE_PROMPT_VERSION:-profile-v1}"
SEARCH_TARGET_PROMPT_VERSION="${SEARCH_TARGET_PROMPT_VERSION:-search-target-v1}"
JOB_POSTING_PROMPT_VERSION="${JOB_POSTING_PROMPT_VERSION:-job-posting-v1}"
JOB_CORPUS_DIR="${JOB_CORPUS_DIR:-fixtures/job-postings}"
RUNTIME_SERVICE_ACCOUNT="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPOSITORY}/${SERVICE_NAME}:${IMAGE_TAG}"

gcloud services enable \
  aiplatform.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  --project "${PROJECT_ID}"

if ! gcloud artifacts repositories describe "${ARTIFACT_REPOSITORY}" --location "${REGION}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${ARTIFACT_REPOSITORY}" \
    --repository-format docker \
    --location "${REGION}" \
    --project "${PROJECT_ID}"
fi

if ! gcloud iam service-accounts describe "${RUNTIME_SERVICE_ACCOUNT}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}" \
    --display-name "Career Radar Cloud Run runtime" \
    --project "${PROJECT_ID}"
fi

if ! DATABASE_TYPE="$(gcloud firestore databases describe --database "(default)" --project "${PROJECT_ID}" --format 'value(type)' 2>/dev/null)"; then
  gcloud firestore databases create \
    --database "(default)" \
    --location "${FIRESTORE_LOCATION}" \
    --type firestore-native \
    --project "${PROJECT_ID}"
elif [[ "${DATABASE_TYPE}" != "FIRESTORE_NATIVE" ]]; then
  echo "The (default) database exists in ${DATABASE_TYPE} mode; Career Radar requires Firestore Native Mode." >&2
  exit 1
fi

if ! gcloud storage buckets describe "gs://${RESUME_BUCKET}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${RESUME_BUCKET}" \
    --location "${REGION}" \
    --uniform-bucket-level-access \
    --project "${PROJECT_ID}"
fi

for secret in "${SHARED_PASSWORD_SECRET}" "${COOKIE_SIGNING_SECRET}"; do
  gcloud secrets describe "${secret}" --project "${PROJECT_ID}" >/dev/null
  gcloud secrets add-iam-policy-binding "${secret}" \
    --member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
    --role roles/secretmanager.secretAccessor \
    --project "${PROJECT_ID}" >/dev/null
done

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role roles/datastore.user >/dev/null
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role roles/aiplatform.user >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://${RESUME_BUCKET}" \
  --member "serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role roles/storage.objectUser >/dev/null

gcloud builds submit --tag "${IMAGE}" --project "${PROJECT_ID}" .

gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --service-account "${RUNTIME_SERVICE_ACCOUNT}" \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 \
  --memory 1Gi \
  --min 0 \
  --max 2 \
  --set-env-vars "APP_ENV=production,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION},GEMINI_MODEL=${GEMINI_MODEL},PROFILE_PROMPT_VERSION=${PROFILE_PROMPT_VERSION},SEARCH_TARGET_PROMPT_VERSION=${SEARCH_TARGET_PROMPT_VERSION},JOB_POSTING_PROMPT_VERSION=${JOB_POSTING_PROMPT_VERSION},RESUME_BUCKET=${RESUME_BUCKET},JOB_SOURCE_BUCKET=${RESUME_BUCKET},JOB_CORPUS_DIR=${JOB_CORPUS_DIR}" \
  --set-secrets "SHARED_PASSWORD=${SHARED_PASSWORD_SECRET}:latest,COOKIE_SIGNING_SECRET=${COOKIE_SIGNING_SECRET}:latest"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --project "${PROJECT_ID}" --format 'value(status.url)')"
echo "Career Radar deployed: ${SERVICE_URL}"
echo "Health check: ${SERVICE_URL}/api/healthz"
