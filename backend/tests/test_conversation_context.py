from __future__ import annotations

from dataclasses import dataclass

from src.advanced.conversation import build_context_window, deterministic_turn_summary


@dataclass
class _Turn:
    role: str
    content: str
    turn_index: int


def test_context_window_trims_to_recent_turns_and_summarizes_older() -> None:
    turns = [
        _Turn(role="user" if idx % 2 == 0 else "assistant", content=f"message {idx}", turn_index=idx)
        for idx in range(10)
    ]

    payload = build_context_window(turns, max_recent=8)

    assert payload["total_turns"] == 10
    assert payload["recent_turns_used"] == 8
    assert payload["summarized_turns"] == 2
    assert len(payload["recent_messages"]) == 8
    assert "message 0" in payload["summary"]
    assert "message 1" in payload["summary"]


def test_deterministic_turn_summary_truncates_long_lines() -> None:
    long_text = "x" * 200
    summary = deterministic_turn_summary([_Turn(role="user", content=long_text, turn_index=0)])
    assert "[user]" in summary
    assert "..." in summary
