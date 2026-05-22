from __future__ import annotations

from src.llm.generate import ReadingGenerator


def test_love_theme_advice_not_forced_to_career(monkeypatch) -> None:
    monkeypatch.setenv("OLLAMA_ENABLED", "false")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    generator = ReadingGenerator()
    generator.api_key = ""
    generator.gemini_api_key = ""

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
        emotion_state=None,
        warnings=[],
    )

    assert any("No LLM backend configured" in warning for warning in warnings)
    # Fallback chuyển sang tiếng Việt + markdown
    assert "tình cảm" in answer
    assert "sự nghiệp" not in answer
    assert "Quá khứ" in answer and "Hiện tại" in answer and "Tương lai" in answer
