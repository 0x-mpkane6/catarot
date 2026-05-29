from __future__ import annotations

import asyncio
import importlib
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image

from src.pipeline.tarot_pipeline import TarotPipeline


def test_pipeline_random_draw_defaults_to_three_when_single_requested() -> None:
    pipeline = TarotPipeline(force_demo_embedder=True)
    result = pipeline.run_pipeline(
        question="Give me guidance",
        audio_path=None,
        image_paths=[],
        spread_type="single",
        random_draw=True,
    )

    assert result["spread_type"] == "three"
    assert len(result["cards"]) == 3
    assert [card["position"] for card in result["cards"]] == ["past", "present", "future"]
    assert all("Chưa có ảnh nào" not in warning for warning in result["warnings"])
    assert any("rút bài ngẫu nhiên" in warning for warning in result["warnings"])


def test_pipeline_random_three_positions() -> None:
    pipeline = TarotPipeline(force_demo_embedder=True)
    result = pipeline.run_pipeline(
        question="What is next?",
        audio_path=None,
        image_paths=[],
        spread_type="three",
        random_draw=True,
    )

    positions = [card.get("position") for card in result["cards"]]
    assert len(result["cards"]) == 3
    assert positions == ["past", "present", "future"]


def test_pipeline_random_ignores_uploaded_images(tmp_path) -> None:
    image_path = tmp_path / "sample.png"
    Image.new("RGB", (256, 256), color=(60, 90, 130)).save(image_path)

    pipeline = TarotPipeline(force_demo_embedder=True)
    result = pipeline.run_pipeline(
        question="Question",
        audio_path=None,
        image_paths=[str(image_path)],
        spread_type="three",
        random_draw=True,
    )

    assert len(result["cards"]) == 3
    assert any("ảnh tải lên đã bị bỏ qua" in warning for warning in result["warnings"])


def test_pipeline_adds_slow_generation_warning(monkeypatch) -> None:
    monkeypatch.setenv("OLLAMA_ENABLED", "false")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setenv("SLOW_GENERATION_WARNING_SECONDS", "0")

    pipeline = TarotPipeline(force_demo_embedder=True)
    result = pipeline.run_pipeline(
        question="Question",
        audio_path=None,
        image_paths=[],
        spread_type="three",
        random_draw=True,
    )

    assert any("Sinh nội dung chậm:" in warning for warning in result["warnings"])


def test_ask_with_media_upload_audio_cleanup(monkeypatch, tmp_path) -> None:
    pytest.importorskip("fastapi")
    from fastapi import UploadFile

    import src.main as main_module

    main_module = importlib.reload(main_module)
    upload_dir = tmp_path / "media_uploads"
    monkeypatch.setenv("API_UPLOAD_DIR", str(upload_dir))

    class DummyPipeline:
        def __init__(self) -> None:
            self.audio_path: str | None = None
            self.audio_exists_when_called = False

        def run_pipeline(
            self,
            question: str,
            audio_path: str | None,
            image_paths: list[str],
            spread_type: str,
            random_draw: bool = False,
        ) -> dict:
            self.audio_path = audio_path
            self.audio_exists_when_called = bool(audio_path and Path(audio_path).exists())
            return {
                "question": question,
                "transcript": None,
                "spread_type": spread_type,
                "cards": [],
                "rag_snippets": [],
                "final_answer": "",
                "warnings": [],
            }

    dummy = DummyPipeline()
    monkeypatch.setattr(main_module, "_get_pipeline", lambda: dummy)

    audio = UploadFile(filename="voice.webm", file=BytesIO(b"fake-audio"))
    result = asyncio.run(
        main_module.ask_with_media(
            request=None,
            question="Audio test",
            spread_type="single",
            random_draw="false",
            image=None,
            audio=audio,
        )
    )

    assert result["spread_type"] == "three"
    assert dummy.audio_path is not None
    assert dummy.audio_exists_when_called is True
    assert upload_dir.exists()
    assert list(upload_dir.glob("*")) == []


def test_ask_with_media_random_without_images(monkeypatch, tmp_path) -> None:
    pytest.importorskip("fastapi")

    import src.main as main_module

    main_module = importlib.reload(main_module)
    upload_dir = tmp_path / "media_uploads_random"
    monkeypatch.setenv("API_UPLOAD_DIR", str(upload_dir))

    class DummyPipeline:
        def __init__(self) -> None:
            self.random_draw = False
            self.image_paths: list[str] = []

        def run_pipeline(
            self,
            question: str,
            audio_path: str | None,
            image_paths: list[str],
            spread_type: str,
            random_draw: bool = False,
        ) -> dict:
            self.random_draw = random_draw
            self.image_paths = list(image_paths)
            return {
                "question": question,
                "transcript": None,
                "spread_type": spread_type,
                "cards": [],
                "rag_snippets": [],
                "final_answer": "",
                "warnings": [],
            }

    dummy = DummyPipeline()
    monkeypatch.setattr(main_module, "_get_pipeline", lambda: dummy)

    result = asyncio.run(
        main_module.ask_with_media(
            request=None,
            question="Random test",
            spread_type="three",
            random_draw="true",
            image=None,
            audio=None,
        )
    )

    assert result["spread_type"] == "three"
    assert dummy.random_draw is True
    assert dummy.image_paths == []
