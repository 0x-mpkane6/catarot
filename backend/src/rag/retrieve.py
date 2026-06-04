"""RAG — truy hồi ý nghĩa lá bài liên quan để LLM bám vào (giảm bịa đặt).

RagRetriever.retrieve(): embedding "câu hỏi + tên lá + chiều" (sentence-transformers),
tìm trong FAISS rồi LỌC theo metadata để snippet đúng lá đang xét. Nhiều lớp dự phòng
(cùng lá khác chiều → placeholder) đảm bảo luôn đủ số snippet tối thiểu. Thiếu
index/thư viện → trả snippet placeholder thay vì báo lỗi.
"""
from __future__ import annotations

import pickle


from src.rag.build_index import RagEmbedder
from src.utils.config import resolve_path
from src.utils.logging import get_logger

LOGGER = get_logger(__name__)

try:
    import faiss  # type: ignore
except Exception:  # pragma: no cover
    faiss = None


class RagRetriever:
    def __init__(
        self,
        index_path: str,
        meta_path: str,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        top_k: int = 3,
        force_demo_embedder: bool = False,
    ) -> None:
        self.index_path = index_path
        self.meta_path = meta_path
        self.top_k = top_k

        self.embedder = RagEmbedder(model_name=model_name, force_demo=force_demo_embedder)
        self.index = None
        self.meta: list[dict] = []
        self.available = False

        if faiss is None:
            LOGGER.warning("faiss is unavailable; RagRetriever will run in fallback mode.")
            return

        try:
            resolved_index = resolve_path(index_path)
            resolved_meta = resolve_path(meta_path)
            if resolved_index.exists() and resolved_meta.exists():
                self.index = faiss.read_index(str(resolved_index))
                with resolved_meta.open("rb") as handle:
                    self.meta = pickle.load(handle)
                self.available = True
            else:
                LOGGER.warning("RAG index/meta not found; fallback snippets will be used.")
        except Exception as exc:
            LOGGER.warning("Failed to load RAG index: %s", exc)

    def list_known_cards(self, limit: int = 78) -> list[str]:
        names = []
        seen = set()
        for row in self.meta:
            name = row.get("metadata", {}).get("card_name")
            if name and name not in seen:
                seen.add(name)
                names.append(name)
            if len(names) >= limit:
                break
        return names

    def _search(self, query: str, top_n: int) -> list[dict]:
        if not self.available or self.index is None:
            return []

        vector = self.embedder.embed_texts([query])[0].reshape(1, -1).astype("float32")
        k = min(max(top_n, self.top_k), len(self.meta))
        scores, indices = self.index.search(vector, k)

        rows = []
        for score, idx in zip(scores[0].tolist(), indices[0].tolist()):
            if idx < 0:
                continue
            item = dict(self.meta[idx])
            item["score"] = float(score)
            rows.append(item)
        return rows

    def _placeholder_snippets(
        self,
        query_text: str,
        desired_k: int,
        card_name: str | None,
        orientation: str | None,
        prefix: str = "fallback",
    ) -> list[dict]:
        fallback_card = card_name or "Unknown card"
        fallback_orientation = orientation or "upright"
        return [
            {
                "source_id": f"{prefix}-{i}",
                "text": (
                    f"{fallback_card} ({fallback_orientation}) suggests reflection related to: "
                    f"{query_text[:140]}"
                ),
                "metadata": {
                    "card_name": fallback_card,
                    "orientation": fallback_orientation,
                },
            }
            for i in range(desired_k)
        ]

    def retrieve(
        self,
        query_text: str,
        card_name: str | None = None,
        orientation: str | None = None,
        top_k: int | None = None,
    ) -> list[dict]:
        desired_k = top_k or self.top_k
        if desired_k <= 0:
            return []

        if not self.available:
            return self._placeholder_snippets(
                query_text=query_text,
                desired_k=desired_k,
                card_name=card_name,
                orientation=orientation,
                prefix="fallback",
            )

        query = query_text
        if card_name:
            query = f"{query} card={card_name}"
        if orientation:
            query = f"{query} orientation={orientation}"

        raw_rows = self._search(query, top_n=max(desired_k * 5, 10))

        filtered = []
        for row in raw_rows:
            metadata = row.get("metadata", {})
            if card_name and metadata.get("card_name") != card_name:
                continue
            if orientation and metadata.get("orientation") != orientation:
                continue
            filtered.append(row)

        chosen = filtered[:desired_k]
        # Strictly keep snippets within the detected card scope.
        if len(chosen) < desired_k and card_name:
            same_card_any_orientation = []
            for row in raw_rows:
                metadata = row.get("metadata", {})
                if metadata.get("card_name") != card_name:
                    continue
                if row in chosen:
                    continue
                same_card_any_orientation.append(row)

            for row in same_card_any_orientation:
                chosen.append(row)
                if len(chosen) >= desired_k:
                    break

        if len(chosen) < desired_k and not card_name:
            for row in raw_rows:
                if row in chosen:
                    continue
                chosen.append(row)
                if len(chosen) >= desired_k:
                    break

        snippets = []
        for row in chosen[:desired_k]:
            snippets.append(
                {
                    "source_id": row.get("id", "unknown"),
                    "text": row.get("text", ""),
                    "metadata": row.get("metadata", {}),
                }
            )

        if len(snippets) < desired_k:
            placeholders = self._placeholder_snippets(
                query_text=query_text,
                desired_k=desired_k - len(snippets),
                card_name=card_name,
                orientation=orientation,
                prefix="placeholder",
            )
            snippets.extend(placeholders)

        return snippets
