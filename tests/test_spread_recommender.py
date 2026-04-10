from __future__ import annotations

from src.advanced.spread_recommender import classify_urgency, classify_topic, recommend_spread


def test_spread_recommender_decision_question_prefers_non_three_spread() -> None:
    result = recommend_spread("I need to choose between two options right now.")
    assert result["topic"] == "decision"
    assert result["urgency"] == "high"
    assert result["recommended_spread"] == "decision_fork"
    assert result["can_run_with_current_backend"] is False
    assert result["fallback_spread"] == "three"


def test_spread_recommender_general_question_keeps_three_spread() -> None:
    result = recommend_spread("Give me general guidance for this week.")
    assert result["recommended_spread"] == "three"
    assert result["can_run_with_current_backend"] is True


def test_classifiers_are_deterministic_for_basic_inputs() -> None:
    assert classify_topic("How is my love life evolving?") == "love"
    assert classify_urgency("Can I decide this today?") == "high"
