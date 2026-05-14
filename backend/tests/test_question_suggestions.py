from __future__ import annotations

from datetime import datetime, timezone

from src.advanced.question_suggestions import generate_question_suggestions, moon_phase_name


def test_moon_phase_name_returns_supported_bucket() -> None:
    phase = moon_phase_name(datetime(2026, 4, 9, tzinfo=timezone.utc))
    assert phase in {"New Moon", "Waxing Moon", "Full Moon", "Waning Moon"}


def test_generate_question_suggestions_returns_exact_limit_with_signals() -> None:
    suggestions = generate_question_suggestions(user_id=None, limit=3)
    assert len(suggestions) == 3
    assert all("text" in row for row in suggestions)
    assert all("reason" in row for row in suggestions)
    assert all("signals" in row for row in suggestions)
    assert all("moon_phase" in row["signals"] for row in suggestions)
    assert all("weekday" in row["signals"] for row in suggestions)
