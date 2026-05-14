from __future__ import annotations

import pytest

from src.rag.build_index import RagEmbedder, build_rag_index
from src.rag.retrieve import RagRetriever
from src.utils.io import write_jsonl


def test_rag_smoke(tmp_path) -> None:
    try:
        import faiss  # noqa: F401
    except Exception:
        pytest.skip("faiss-cpu not installed")

    corpus_path = tmp_path / "corpus.jsonl"
    index_path = tmp_path / "index.faiss"
    meta_path = tmp_path / "meta.pkl"

    rows = [
        {
            "id": "the-fool-upright",
            "text": "The Fool upright means new beginnings and bold steps.",
            "metadata": {"card_name": "The Fool", "orientation": "upright"},
        },
        {
            "id": "the-fool-reversed",
            "text": "The Fool reversed indicates impulsive risks and delays.",
            "metadata": {"card_name": "The Fool", "orientation": "reversed"},
        },
        {
            "id": "the-magician-upright",
            "text": "The Magician upright means manifesting with focused intent.",
            "metadata": {"card_name": "The Magician", "orientation": "upright"},
        },
    ]
    write_jsonl(corpus_path, rows)

    embedder = RagEmbedder(force_demo=True)
    build_rag_index(corpus_path, index_path, meta_path, embedder=embedder, batch_size=8)

    retriever = RagRetriever(
        index_path=str(index_path),
        meta_path=str(meta_path),
        top_k=3,
        force_demo_embedder=True,
    )

    snippets = retriever.retrieve(
        query_text="I want a fresh start",
        card_name="The Fool",
        orientation="upright",
        top_k=2,
    )

    assert len(snippets) >= 2
    assert all("text" in row for row in snippets)
    assert all(row.get("metadata", {}).get("card_name") == "The Fool" for row in snippets)
