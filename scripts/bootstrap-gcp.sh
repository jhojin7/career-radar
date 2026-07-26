#!/usr/bin/env bash
set -euo pipefail

project_id="${GCP_PROJECT_ID:-}"
region="${GCP_REGION:-asia-northeast3}"

if [[ -z "${project_id}" ]]; then
  echo "GCP_PROJECT_ID is required." >&2
  echo "Usage: GCP_PROJECT_ID=your-project-id scripts/bootstrap-gcp.sh" >&2
  exit 2
fi

echo "Target project: ${project_id}"
echo "Default region: ${region}"
read -r -p "Enable Career Radar APIs in this project? [y/N] " answer
if [[ ! "${answer}" =~ ^[Yy]$ ]]; then
  echo "No changes made."
  exit 0
fi

gcloud config set project "${project_id}"
gcloud config set run/region "${region}"
gcloud services enable \
  aiplatform.googleapis.com \
  artifactregistry.googleapis.com \
  bigquery.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com

echo "Career Radar APIs are enabled for ${project_id}."

