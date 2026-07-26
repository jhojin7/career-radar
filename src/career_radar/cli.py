import argparse
import hashlib
import json
from datetime import UTC, datetime
from typing import Any

from pydantic import ValidationError

from career_radar.config import load_settings
from career_radar.domain import EmploymentType, Job


def sample_job() -> Job:
    description = "Build and operate reliable cloud-native services on Google Cloud."
    return Job(
        source="manual",
        source_job_id="sample-001",
        canonical_url="https://example.com/jobs/sample-001",
        company="Example Cloud",
        title="Cloud Platform Engineer",
        location="Seoul, South Korea",
        employment_type=EmploymentType.FULL_TIME,
        experience_min=2,
        experience_max=5,
        description_text=description,
        posted_at=datetime(2026, 7, 25, tzinfo=UTC),
        expires_at=datetime(2026, 8, 25, tzinfo=UTC),
        collected_at=datetime.now(UTC),
        content_hash=hashlib.sha256(description.encode()).hexdigest(),
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="career-radar")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("sample-job", help="print one validated sample Job as JSON")
    subparsers.add_parser("check-config", help="validate cloud environment variables")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    if args.command == "sample-job":
        print(sample_job().model_dump_json(indent=2))
        return 0

    try:
        settings = load_settings()
    except ValidationError as error:
        print("Invalid Career Radar configuration:")
        print(error)
        return 2

    safe_settings: dict[str, Any] = {
        "gcp_project_id": settings.gcp_project_id,
        "gcp_region": settings.gcp_region,
        "bigquery_dataset": settings.bigquery_dataset,
        "gcs_bucket": settings.gcs_bucket,
        "gemini_model": settings.gemini_model,
    }
    print(json.dumps(safe_settings, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
