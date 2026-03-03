from __future__ import annotations

from src.llm.generate import ReadingGenerator


def test_love_theme_advice_not_forced_to_career(monkeypatch) -> None:
    monkeypatch.setenv("OLLAMA_ENABLED", "false")
    generator = ReadingGenerator()
    generator.api_key = ""

    cards = [
        {"name": "Temperance", "orientation": "upright", "position": "past", "confidence": 0.8, "topk_candidates": []},
        {"name": "The Devil", "orientation": "upright", "position": "present", "confidence": 0.8, "topk_candidates": []},
        {"name": "The Tower", "orientation": "upright", "position": "future", "confidence": 0.8, "topk_candidates": []},
    ]
    snippets = [
        {"source_id": "s1", "text": "Temperance upright meaning...", "metadata": {"card_name": "Temperance", "orientation": "upright"}},
        {"source_id": "s2", "text": "The Devil upright meaning...", "metadata": {"card_name": "The Devil", "orientation": "upright"}},
        {"source_id": "s3", "text": "The Tower upright meaning...", "metadata": {"card_name": "The Tower", "orientation": "upright"}},
    ]

    answer, warnings = generator.generate(
        question="What's ahead for my love life?",
        transcript=None,
        spread_type="three",
        cards=cards,
        rag_snippets=snippets,
        warnings=[],
    )

    assert any("No LLM backend configured" in warning for warning in warnings)
    assert "Chu de chinh: love" in answer
    assert "nghe nghiep" not in answer.lower()
    assert "[past]" in answer and "[present]" in answer and "[future]" in answer
