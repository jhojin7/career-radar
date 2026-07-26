from collections.abc import AsyncIterator
from typing import Protocol

from career_radar.domain import Job


class JobSource(Protocol):
    """Contract implemented by manual, JOB-ALIO, and ATS source adapters."""

    @property
    def name(self) -> str: ...

    def collect(self) -> AsyncIterator[Job]: ...
