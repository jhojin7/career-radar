from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from career_radar.cli import sample_job
from career_radar.domain import Job


def test_sample_job_is_valid() -> None:
    job = sample_job()

    assert job.source == "manual"
    assert job.company == "Example Cloud"
    assert len(job.content_hash) == 64


def test_required_field_is_rejected() -> None:
    payload = sample_job().model_dump()
    del payload["title"]

    with pytest.raises(ValidationError, match="title"):
        Job.model_validate(payload)


def test_inverted_experience_range_is_rejected() -> None:
    payload = sample_job().model_dump()
    payload.update(experience_min=5, experience_max=2)

    with pytest.raises(ValidationError, match="experience_max"):
        Job.model_validate(payload)


def test_expiration_before_posting_is_rejected() -> None:
    payload = sample_job().model_dump()
    payload.update(
        posted_at=datetime(2026, 7, 26, tzinfo=UTC),
        expires_at=datetime(2026, 7, 25, tzinfo=UTC),
    )

    with pytest.raises(ValidationError, match="expires_at"):
        Job.model_validate(payload)
