from __future__ import annotations

import asyncio
import importlib
from io import BytesIO
from pathlib import Path

import pytest

from src.llm.generate import _detect_theme
from src.utils.config import get_config_value, load_config


def test_theme_detection_avoids_short_token_false_positive() -> None:
    theme = _detect_theme("I don't know what to do next.", None)
    assert theme == "general"


def test_load_config_keeps_yaml_paths_without_explicit_env_override(monkeypatch, tmp_path) -> None:
    monkeypatch.chdir(tmp_path)
    for env_name in [
        "DATA_DIR",
        "FAISS_INDEX_PATH",
        "FAISS_META_PATH",
        "RAG_INDEX_PATH",
        "RAG_META_PATH",
    ]:
        monkeypatch.delenv(env_name, raising=False)

    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        "paths:\n"
        "  vision_index_path: ./custom/vision.index\n"
        "  vision_meta_path: ./custom/vision_meta.json\n"
        "  rag_index_path: ./custom/rag.index\n"
        "  rag_meta_path: ./custom/rag_meta.pkl\n",
        encoding="utf-8",
    )

    config = load_config(config_paths=[config_path])

    assert get_config_value(config, "paths", "vision_index_path") == "./custom/vision.index"
    assert get_config_value(config, "paths", "vision_meta_path") == "./custom/vision_meta.json"
    assert get_config_value(config, "paths", "rag_index_path") == "./custom/rag.index"
    assert get_config_value(config, "paths", "rag_meta_path") == "./custom/rag_meta.pkl"


def test_load_config_applies_explicit_env_override(monkeypatch, tmp_path) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("FAISS_INDEX_PATH", "./env/override.index")

    config_path = tmp_path / "config.yaml"
    config_path.write_text(
        "paths:\n"
        "  vision_index_path: ./custom/vision.index\n",
        encoding="utf-8",
    )

    config = load_config(config_paths=[config_path])
    assert get_config_value(config, "paths", "vision_index_path") == "./env/override.index"


def test_cors_defaults_include_localhost_and_loopback(monkeypatch) -> None:
    pytest.importorskip("fastapi")
    monkeypatch.delenv("API_ALLOWED_ORIGINS", raising=False)

    import src.main as main_module

    main_module = importlib.reload(main_module)
    cors_middleware = next(m for m in main_module.app.user_middleware if m.cls.__name__ == "CORSMiddleware")
    allow_origins = cors_middleware.kwargs.get("allow_origins", [])

    assert "http://localhost:5173" in allow_origins
    assert "http://127.0.0.1:5173" in allow_origins


def test_allowed_origins_parser_trims_whitespace(monkeypatch) -> None:
    pytest.importorskip("fastapi")
    monkeypatch.setenv("API_ALLOWED_ORIGINS", " http://a.local , http://b.local ")

    import src.main as main_module

    assert main_module._allowed_origins_from_env() == ["http://a.local", "http://b.local"]


def test_ask_with_image_caps_to_three_files_and_cleans_all_uploads(monkeypatch, tmp_path) -> None:
    pytest.importorskip("fastapi")
    from fastapi import UploadFile

    import src.main as main_module

    upload_dir = tmp_path / "uploads"
    monkeypatch.setenv("API_UPLOAD_DIR", str(upload_dir))

    class DummyPipeline:
        def __init__(self) -> None:
            self.received_image_paths: list[str] = []
            self.saved_count_when_called = 0

        def run_pipeline(
            self,
            question: str,
            audio_path: str | None,
            image_paths: list[str],
            spread_type: str,
            random_draw: bool = False,
        ) -> dict:
            self.received_image_paths = list(image_paths)
            self.saved_count_when_called = len(list(Path(upload_dir).glob("*")))
            return {
                "question": question,
                "transcript": audio_path,
                "spread_type": spread_type,
                "cards": [],
                "rag_snippets": [],
                "final_answer": "",
                "warnings": [],
            }

    dummy = DummyPipeline()
    monkeypatch.setattr(main_module, "_get_pipeline", lambda: dummy)

    files = [
        UploadFile(filename=f"card_{idx}.png", file=BytesIO(b"fake-image-content"))
        for idx in range(4)
    ]

    result = main_module.ask_with_image(
        request=None,
        question="test question",
        spread_type="single",
        image=files,
    )

    assert result["spread_type"] == "three"
    assert len(dummy.received_image_paths) == 3
    assert dummy.saved_count_when_called == 4
    assert upload_dir.exists()
    assert list(upload_dir.glob("*")) == []


def test_ask_with_image_three_spread_uses_three_files(monkeypatch, tmp_path) -> None:
    pytest.importorskip("fastapi")
    from fastapi import UploadFile

    import src.main as main_module

    upload_dir = tmp_path / "uploads_three"
    monkeypatch.setenv("API_UPLOAD_DIR", str(upload_dir))

    class DummyPipeline:
        def __init__(self) -> None:
            self.received_image_paths: list[str] = []

        def run_pipeline(
            self,
            question: str,
            audio_path: str | None,
            image_paths: list[str],
            spread_type: str,
            random_draw: bool = False,
        ) -> dict:
            self.received_image_paths = list(image_paths)
            return {
                "question": question,
                "transcript": audio_path,
                "spread_type": spread_type,
                "cards": [{"name": "X"} for _ in image_paths],
                "rag_snippets": [],
                "final_answer": "",
                "warnings": [],
            }

    dummy = DummyPipeline()
    monkeypatch.setattr(main_module, "_get_pipeline", lambda: dummy)

    files = [
        UploadFile(filename=f"card_{idx}.png", file=BytesIO(b"fake-image-content"))
        for idx in range(3)
    ]

    result = main_module.ask_with_image(
        request=None,
        question="test question",
        spread_type="three",
        image=files,
    )

    assert result["spread_type"] == "three"
    assert len(dummy.received_image_paths) == 3
    assert len(result["cards"]) == 3
    assert upload_dir.exists()
    assert list(upload_dir.glob("*")) == []
