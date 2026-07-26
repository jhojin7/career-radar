.PHONY: setup check test sample config-check

setup:
	uv sync

check:
	uv run ruff check .
	uv run ruff format --check .
	uv run pytest

test:
	uv run pytest

sample:
	uv run career-radar sample-job

config-check:
	uv run career-radar check-config

