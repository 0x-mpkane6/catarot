from __future__ import annotations

import random
from pathlib import Path
from typing import Any

from src.asr.transcribe import transcribe_audio
from src.llm.generate import ReadingGenerator
from src.rag.retrieve import RagRetriever
from src.utils.config import get_config_value, load_config
from src.utils.logging import get_logger
from src.vision.embedder import VisionEmbedder
from src.vision.predict_card import CardPredictor

LOGGER = get_logger(__name__)

DEFAULT_MAJOR_ARCANA = [
    "The Fool",
    "The Magician",
    "The High Priestess",
    "The Empress",
    "The Emperor",
    "The Hierophant",
    "The Lovers",
    "The Chariot",
    "Strength",
    "The Hermit",
    "Wheel of Fortune",
    "Justice",
    "The Hanged Man",
    "Death",
    "Temperance",
    "The Devil",
    "The Tower",
    "The Star",
    "The Moon",
    "The Sun",
    "Judgement",
    "The World",
]


def _coerce_image_paths(image_paths: Any) -> list[str]:
    if image_paths is None:
        return []
    if isinstance(image_paths, str):
        return [image_paths]

    output = []
    if isinstance(image_paths, (list, tuple)):
        for item in image_paths:
            if item is None:
                continue
            if isinstance(item, str):
                output.append(item)
            elif hasattr(item, "name"):
                output.append(str(item.name))
            elif isinstance(item, dict) and item.get("path"):
                output.append(str(item["path"]))
            else:
                output.append(str(item))
    else:
        output.append(str(image_paths))

    return [path for path in output if path]


class TarotPipeline:
    def __init__(self, config: dict | None = None, force_demo_embedder: bool = False) -> None:
        self.config = config or load_config()

        self.confidence_threshold = float(get_config_value(self.config, "app", "confidence_threshold", default=0.18))
        self.top_k_candidates = int(get_config_value(self.config, "app", "top_k_candidates", default=5))
        self.rag_snippets_per_card = int(get_config_value(self.config, "app", "rag_snippets_per_card", default=2))
        self.rag_min_snippets = int(get_config_value(self.config, "app", "rag_min_snippets", default=3))

        vision_model_name = get_config_value(self.config, "vision", "model_name", default="ViT-B-32")
        vision_pretrained = get_config_value(self.config, "vision", "pretrained", default="laion2b_s34b_b79k")
        vision_device = get_config_value(self.config, "vision", "device", default="cpu")
        rag_model_name = get_config_value(
            self.config,
            "rag",
            "model_name",
            default="sentence-transformers/all-MiniLM-L6-v2",
        )
        rag_top_k = int(get_config_value(self.config, "rag", "top_k", default=3))

        tarot_images_json_path = get_config_value(self.config, "paths", "tarot_images_json", default="")

        embedder = VisionEmbedder(
            model_name=vision_model_name,
            pretrained=vision_pretrained,
            device=vision_device,
            force_demo=force_demo_embedder,
        )

        self.card_predictor = CardPredictor(
            index_path=get_config_value(self.config, "paths", "vision_index_path", default="./models/vision/faiss.index"),
            meta_path=get_config_value(self.config, "paths", "vision_meta_path", default="./models/vision/faiss_meta.json"),
            top_k=self.top_k_candidates,
            tarot_images_json_path=tarot_images_json_path,
            embedder=embedder,
        )

        self.rag_retriever = RagRetriever(
            index_path=get_config_value(self.config, "paths", "rag_index_path", default="./models/rag/index.faiss"),
            meta_path=get_config_value(self.config, "paths", "rag_meta_path", default="./models/rag/meta.pkl"),
            model_name=rag_model_name,
            top_k=rag_top_k,
            force_demo_embedder=force_demo_embedder,
        )

        self.reader = ReadingGenerator()

    def _spread_positions(self, spread_type: str) -> list[str]:
        _ = spread_type
        positions = get_config_value(self.config, "app", "spread_positions", "three", default=None)
        if positions:
            return positions
        return ["past", "present", "future"]

    def _build_card_outputs(self, image_paths: list[str], spread_type: str, warnings: list[str]) -> list[dict]:
        cards = []
        positions = self._spread_positions(spread_type)

        if len(image_paths) > 3:
            warnings.append("Spread three expects up to 3 images; extra images were ignored.")
            image_paths = image_paths[:3]
        if 0 < len(image_paths) < 3:
            warnings.append("Spread three ideally uses 3 images (past/present/future).")

        for idx, image_path in enumerate(image_paths):
            result = self.card_predictor.predict(image_path)
            if result.get("_warning"):
                warnings.append(result["_warning"])

            confidence = float(result.get("confidence", 0.0))
            if confidence < self.confidence_threshold:
                warnings.append(
                    (
                        f"Low confidence for image {Path(image_path).name} "
                        f"({confidence:.2f} < {self.confidence_threshold:.2f}). "
                        "Ket qua chua chac. Try recropping or selecting from top-5 candidates."
                    )
                )

            cards.append(
                {
                    "name": result.get("name", "Unknown Card"),
                    "orientation": result.get("orientation", "upright"),
                    "position": positions[idx] if idx < len(positions) else f"slot_{idx+1}",
                    "confidence": confidence,
                    "topk_candidates": result.get("topk_candidates", []),
                }
            )

        return cards

    def _draw_random_cards(self, spread_type: str, warnings: list[str]) -> list[dict]:
        positions = self._spread_positions(spread_type)
        target_count = 3

        pool: list[str] = []
        seen = set()

        for name in self.rag_retriever.list_known_cards(limit=120):
            if name and name not in seen:
                seen.add(name)
                pool.append(name)

        if len(pool) < target_count:
            for name in self.card_predictor.list_candidate_cards(limit=120):
                if name and name not in seen:
                    seen.add(name)
                    pool.append(name)

        if not pool:
            pool = list(DEFAULT_MAJOR_ARCANA)

        if len(pool) >= target_count:
            selected_names = random.sample(pool, target_count)
        else:
            selected_names = [random.choice(pool) for _ in range(target_count)]

        cards: list[dict] = []
        for idx, name in enumerate(selected_names):
            orientation = random.choice(["upright", "reversed"])
            cards.append(
                {
                    "name": name,
                    "orientation": orientation,
                    "position": positions[idx] if idx < len(positions) else f"slot_{idx+1}",
                    "confidence": 0.55,
                    "topk_candidates": [],
                }
            )

        warnings.append(f"Random draw enabled: generated {len(cards)} card(s) without image prediction.")
        return cards

    def _apply_overrides(self, cards: list[dict], card_overrides: dict[int, dict] | None) -> None:
        if not card_overrides:
            return
        for idx, override in card_overrides.items():
            if idx < 0 or idx >= len(cards):
                continue
            if override.get("name"):
                cards[idx]["name"] = override["name"]
            if override.get("orientation") in {"upright", "reversed"}:
                cards[idx]["orientation"] = override["orientation"]
            cards[idx]["confidence"] = max(float(cards[idx].get("confidence", 0.0)), 0.5)

    def _collect_snippets(
        self,
        query_text: str,
        cards: list[dict],
    ) -> list[dict]:
        snippets: list[dict] = []
        seen = set()

        for card in cards:
            rows = self.rag_retriever.retrieve(
                query_text=query_text,
                card_name=card.get("name"),
                orientation=card.get("orientation"),
                top_k=self.rag_snippets_per_card,
            )
            for row in rows:
                key = (row.get("source_id"), row.get("text"))
                if key in seen:
                    continue
                seen.add(key)
                snippets.append(row)

        if len(snippets) < self.rag_min_snippets:
            if not cards:
                fallback_rows = self.rag_retriever.retrieve(
                    query_text=query_text,
                    top_k=self.rag_min_snippets,
                )
                for row in fallback_rows:
                    key = (row.get("source_id"), row.get("text"))
                    if key in seen:
                        continue
                    seen.add(key)
                    snippets.append(row)
                    if len(snippets) >= self.rag_min_snippets:
                        break

        if len(snippets) < self.rag_min_snippets:
            for card in cards:
                fallback_rows = self.rag_retriever.retrieve(
                    query_text=query_text,
                    card_name=card.get("name"),
                    orientation=None,
                    top_k=self.rag_min_snippets,
                )
                for row in fallback_rows:
                    key = (row.get("source_id"), row.get("text"))
                    if key in seen:
                        continue
                    seen.add(key)
                    snippets.append(row)
                    if len(snippets) >= self.rag_min_snippets:
                        break
                if len(snippets) >= self.rag_min_snippets:
                    break

        if len(snippets) < self.rag_min_snippets and cards:
            # Final safeguard to keep snippet card scope aligned with detected cards.
            first_card = cards[0]
            while len(snippets) < self.rag_min_snippets:
                snippets.append(
                    {
                        "source_id": f"card-scope-fallback-{len(snippets)}",
                        "text": (
                            f"{first_card.get('name', 'Unknown Card')} "
                            f"({first_card.get('orientation', 'upright')}) "
                            f"relates to: {query_text[:140]}"
                        ),
                        "metadata": {
                            "card_name": first_card.get("name", "Unknown Card"),
                            "orientation": first_card.get("orientation", "upright"),
                        },
                    }
                )

        return snippets[: max(self.rag_min_snippets, len(snippets))]

    def run_pipeline(
        self,
        question: str,
        audio_path: str | None,
        image_paths: Any,
        spread_type: str,
        card_overrides: dict[int, dict] | None = None,
        random_draw: bool = False,
    ) -> dict:
        warnings: list[str] = []

        clean_question = (question or "").strip()
        clean_spread = "three"
        if clean_spread != spread_type:
            warnings.append(f"Only spread_type 'three' is supported; received '{spread_type}', defaulted to 'three'.")

        transcript, asr_warnings = transcribe_audio(audio_path)
        warnings.extend(asr_warnings)

        normalized_images = _coerce_image_paths(image_paths)
        if random_draw:
            if normalized_images:
                warnings.append("Random draw enabled; uploaded images ignored.")
            cards = self._draw_random_cards(clean_spread, warnings)
        else:
            if not normalized_images:
                warnings.append("No image provided. Upload at least one tarot card image for prediction.")
            cards = self._build_card_outputs(normalized_images, clean_spread, warnings)

        self._apply_overrides(cards, card_overrides)

        query = clean_question
        if transcript:
            query = f"{query} {transcript}".strip()
        if not query:
            query = "General tarot guidance"

        rag_snippets = self._collect_snippets(query, cards)

        final_answer, generation_warnings = self.reader.generate(
            question=clean_question or "(No question provided)",
            transcript=transcript,
            spread_type=clean_spread,
            cards=cards,
            rag_snippets=rag_snippets,
            warnings=warnings,
        )
        warnings.extend(generation_warnings)

        return {
            "question": clean_question,
            "transcript": transcript,
            "spread_type": clean_spread,
            "cards": cards,
            "rag_snippets": rag_snippets,
            "final_answer": final_answer,
            "warnings": warnings,
        }
