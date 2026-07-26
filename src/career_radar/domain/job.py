from datetime import datetime
from enum import StrEnum

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, model_validator


class EmploymentType(StrEnum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    INTERN = "intern"
    TEMPORARY = "temporary"
    OTHER = "other"


class Job(BaseModel):
    """Canonical job posting shared by every source adapter."""

    model_config = ConfigDict(extra="forbid")

    source: str = Field(min_length=1)
    source_job_id: str = Field(min_length=1)
    canonical_url: AnyHttpUrl
    company: str = Field(min_length=1)
    title: str = Field(min_length=1)
    location: str = Field(min_length=1)
    employment_type: EmploymentType | None = None
    experience_min: int | None = Field(default=None, ge=0)
    experience_max: int | None = Field(default=None, ge=0)
    description_text: str = Field(min_length=1)
    posted_at: datetime | None = None
    expires_at: datetime | None = None
    collected_at: datetime
    content_hash: str = Field(pattern=r"^[0-9a-f]{64}$")

    @model_validator(mode="after")
    def validate_ranges_and_dates(self) -> "Job":
        if (
            self.experience_min is not None
            and self.experience_max is not None
            and self.experience_max < self.experience_min
        ):
            raise ValueError("experience_max must be greater than or equal to experience_min")
        if self.posted_at and self.expires_at and self.expires_at < self.posted_at:
            raise ValueError("expires_at must be later than or equal to posted_at")
        return self
