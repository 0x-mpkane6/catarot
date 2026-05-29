from __future__ import annotations

import re

TOKEN_RE = re.compile(r"[a-z0-9_]+", re.IGNORECASE)

SPREAD_CATALOG: dict[str, dict[str, str]] = {
    "three": {
        "label": "three",
        "rationale": "Trải 3 lá ngắn gọn, hợp để xem định hướng tổng quát.",
    },
    "celtic_cross": {
        "label": "celtic_cross",
        "rationale": "Celtic Cross cho bối cảnh sâu hơn với những tình huống phức tạp, nhiều tầng lớp.",
    },
    "decision_fork": {
        "label": "decision_fork",
        "rationale": "Decision Fork giúp so sánh các lựa chọn và hệ quả trong ngắn hạn.",
    },
    "inner_shadow": {
        "label": "inner_shadow",
        "rationale": "Trải Inner Shadow hợp cho việc nhìn vào nội tâm và xử lý cảm xúc.",
    },
    "relationship_bridge": {
        "label": "relationship_bridge",
        "rationale": "Relationship Bridge tập trung vào động lực và cách giao tiếp trong mối quan hệ.",
    },
}


def _normalize_text(value: str) -> str:
    return (value or "").strip().lower()


def _extract_tokens(text: str) -> set[str]:
    return set(TOKEN_RE.findall(_normalize_text(text)))


def classify_topic(question: str) -> str:
    text = _normalize_text(question)
    tokens = _extract_tokens(text)

    topic_keywords: dict[str, set[str]] = {
        "love": {"love", "relationship", "romance", "dating", "tinh", "cam", "vo", "chong", "crush"},
        "career": {"career", "job", "work", "promotion", "business", "su", "nghiep", "cong", "viec"},
        "finance": {"finance", "money", "income", "debt", "investment", "tai", "chinh", "tien"},
        "decision": {"choose", "option", "decide", "choice", "quyet", "dinh", "chon"},
        "inner_work": {"anxiety", "stress", "fear", "healing", "self", "inner", "noi", "tam", "cam", "xuc"},
    }

    for topic, keywords in topic_keywords.items():
        if tokens.intersection(keywords):
            return topic
        for keyword in keywords:
            if len(keyword) > 4 and keyword in text:
                return topic
    return "general"


def classify_urgency(question: str) -> str:
    text = _normalize_text(question)
    high_markers = {
        "urgent",
        "asap",
        "immediately",
        "right now",
        "today",
        "ngay",
        "gap",
        "khan cap",
        "hom nay",
    }
    medium_markers = {
        "this week",
        "soon",
        "next",
        "tuan nay",
        "sap toi",
    }

    if any(marker in text for marker in high_markers):
        return "high"
    if any(marker in text for marker in medium_markers):
        return "medium"
    return "low"


def _recommended_spread(topic: str, urgency: str) -> str:
    if topic == "decision":
        return "decision_fork"
    if topic == "inner_work":
        return "inner_shadow"
    if topic == "love":
        return "relationship_bridge"
    if topic in {"career", "finance"} and urgency != "high":
        return "celtic_cross"
    return "three"


def recommend_spread(question: str) -> dict[str, str | bool]:
    topic = classify_topic(question)
    urgency = classify_urgency(question)
    spread = _recommended_spread(topic, urgency)
    spread_meta = SPREAD_CATALOG.get(spread, SPREAD_CATALOG["three"])
    can_run_now = spread == "three"

    rationale = spread_meta["rationale"]
    if not can_run_now:
        rationale = f"{rationale} Hiện tại backend vẫn chạy bằng trải bài 3 lá."

    return {
        "recommended_spread": spread_meta["label"],
        "rationale": rationale,
        "topic": topic,
        "urgency": urgency,
        "can_run_with_current_backend": can_run_now,
        "fallback_spread": "three",
    }

