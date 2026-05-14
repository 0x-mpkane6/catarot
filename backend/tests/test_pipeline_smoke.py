from __future__ import annotations

from PIL import Image

from src.pipeline.tarot_pipeline import TarotPipeline


def test_pipeline_smoke(tmp_path) -> None:
    image_paths: list[str] = []
    for idx in range(3):
        image_path = tmp_path / f"sample_{idx}.png"
        Image.new("RGB", (256, 256), color=(180 + idx, 140, 100)).save(image_path)
        image_paths.append(str(image_path))

    pipeline = TarotPipeline(force_demo_embedder=True)
    result = pipeline.run_pipeline(
        question="What should I focus on this week?",
        audio_path=None,
        image_paths=image_paths,
        spread_type="three",
    )

    required_keys = {
        "question",
        "transcript",
        "spread_type",
        "cards",
        "rag_snippets",
        "final_answer",
        "warnings",
    }

    assert required_keys.issubset(result.keys())
    assert isinstance(result["cards"], list)
    assert isinstance(result["rag_snippets"], list)
    assert isinstance(result["warnings"], list)

    if result["cards"] and result["rag_snippets"]:
        allowed = {card["name"] for card in result["cards"]}
        snippet_cards = {
            row.get("metadata", {}).get("card_name")
            for row in result["rag_snippets"]
            if row.get("metadata")
        }
        assert snippet_cards.issubset(allowed)
