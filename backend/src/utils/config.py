from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

_ENV_PATTERN = re.compile(r"\$\{([A-Z0-9_]+)\}")


_ENV_OVERRIDES = {
    "DATA_DIR": ("paths", "data_dir"),
    "FAISS_INDEX_PATH": ("paths", "vision_index_path"),
    "FAISS_META_PATH": ("paths", "vision_meta_path"),
    "RAG_INDEX_PATH": ("paths", "rag_index_path"),
    "RAG_META_PATH": ("paths", "rag_meta_path"),
}

_ENV_DEFAULTS = {
    "DATA_DIR": "./data",
    "FAISS_INDEX_PATH": "./models/vision/faiss.index",
    "FAISS_META_PATH": "./models/vision/faiss_meta.json",
    "RAG_INDEX_PATH": "./models/rag/index.faiss",
    "RAG_META_PATH": "./models/rag/meta.pkl",
}


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _deep_merge(base: dict[str, Any], extra: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in extra.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _expand_env(value: Any) -> Any:
    if isinstance(value, str):
        return _ENV_PATTERN.sub(lambda m: os.getenv(m.group(1), m.group(0)), value)
    if isinstance(value, dict):
        return {k: _expand_env(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_expand_env(v) for v in value]
    return value


def _set_nested(target: dict[str, Any], key_path: tuple[str, ...], value: Any) -> None:
    current = target
    for key in key_path[:-1]:
        current = current.setdefault(key, {})
    current[key_path[-1]] = value


def _load_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    if not isinstance(data, dict):
        raise ValueError(f"Config file must be a mapping: {path}")
    return data


def load_config(config_paths: list[str | Path] | None = None) -> dict[str, Any]:
    explicit_env_overrides = {env_name: os.getenv(env_name) for env_name in _ENV_OVERRIDES}
    load_dotenv()
    for env_name, fallback in _ENV_DEFAULTS.items():
        os.environ.setdefault(env_name, fallback)

    root = _project_root()
    default_paths = [
        root / "configs" / "app.yaml",
        root / "configs" / "vision_retrieval.yaml",
        root / "configs" / "rag.yaml",
    ]
    paths = [Path(path) for path in (config_paths or default_paths)]

    merged: dict[str, Any] = {}
    for path in paths:
        resolved = path if path.is_absolute() else root / path
        merged = _deep_merge(merged, _load_yaml(resolved))

    merged = _expand_env(merged)

    for env_name, key_path in _ENV_OVERRIDES.items():
        explicit_value = explicit_env_overrides.get(env_name)
        if explicit_value:
            _set_nested(merged, key_path, explicit_value)

    merged.setdefault("paths", {})
    merged["paths"].setdefault("data_dir", "./data")

    return merged


def resolve_path(path_value: str | Path) -> Path:
    path = Path(path_value)
    if path.is_absolute():
        return path
    return _project_root() / path


def get_config_value(config: dict[str, Any], *keys: str, default: Any = None) -> Any:
    current: Any = config
    for key in keys:
        if not isinstance(current, dict):
            return default
        current = current.get(key)
        if current is None:
            return default
    return current
