import pytest
from pydantic import ValidationError

from career_radar.config import Settings


def test_gcp_project_id_is_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("GCP_PROJECT_ID", raising=False)

    with pytest.raises(ValidationError, match="gcp_project_id"):
        Settings(_env_file=None)


def test_defaults_are_suitable_for_seoul() -> None:
    settings = Settings(gcp_project_id="career-radar-test", _env_file=None)

    assert settings.gcp_region == "asia-northeast3"
    assert settings.bigquery_dataset == "career_radar"
