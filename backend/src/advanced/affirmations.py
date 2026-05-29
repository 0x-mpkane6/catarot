"""Bộ sinh lời khẳng định (affirmation) theo thẻ ngày.

Thuần Python (không gọi LLM) để giữ độ trễ thấp và dùng được như widget ở
frontend. Kết quả tất định theo lá/chiều/ngày nên cùng một lá trong cùng một
ngày luôn cho ra cùng một lời khẳng định.
"""
from __future__ import annotations

import hashlib
from datetime import date

from src.llm.card_meanings_vi import card_keywords_vi

# Mẫu lời khẳng định tiếng Việt cho lá Xuôi (năng lượng thuận, hướng ra ngoài).
_AFFIRMATION_TEMPLATES_UPRIGHT = [
    "Hôm nay tôi mở lòng đón nhận {kw1}, tin rằng {kw2} sẽ dẫn lối cho bước tiếp theo.",
    "Tôi chào đón {kw1} vào ngày của mình và tin vào nhịp điệu của {kw2}.",
    "Tôi vững vàng trong {kw1}, hành động bằng {kw2} và an trú trong {kw3}.",
    "Dù còn nhiều điều chưa chắc chắn, tôi vẫn chọn {kw1}; {kw2} là đủ cho hôm nay.",
    "Tôi để {kw1} dẫn đường và để {kw2} giữ tôi vững vàng.",
]

# Mẫu cho lá Ngược (dịu hơn, nói về việc gỡ bỏ điều đang kìm hãm).
_AFFIRMATION_TEMPLATES_REVERSED = [
    "Tôi nhận ra nơi {kw1} đang bị kìm lại, và nhẹ nhàng mời {kw2} quay trở về.",
    "Hôm nay tôi buông bớt sự kháng cự với {kw1}; {kw2} sẽ trở lại khi tôi sẵn sàng.",
    "Tôi tha thứ cho những điều còn dang dở và hướng về {kw1} một lần nữa.",
    "Tôi trân trọng bài học ẩn trong {kw1}; {kw2} là con đường tôi trở về.",
    "Chậm lại một nhịp cũng không sao. Tôi để {kw1} lắng xuống để {kw2} được trỗi dậy.",
]


def _digest_index(seed: str, modulo: int) -> int:
    if modulo <= 0:
        return 0
    digest = hashlib.sha1(seed.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % modulo


def generate_affirmation(
    *,
    card_name: str,
    orientation: str = "upright",
    suit: str | None = None,
    keywords: list[str] | None = None,
    target_date: date | None = None,
) -> dict[str, object]:
    """Tạo lời khẳng định tất định theo lá/chiều/ngày."""

    clean_card = (card_name or "").strip() or "The Fool"
    clean_orientation = (orientation or "upright").strip().lower()
    if clean_orientation not in {"upright", "reversed"}:
        clean_orientation = "upright"

    chosen_keywords = [k.strip() for k in (keywords or []) if k and k.strip()]
    if not chosen_keywords:
        chosen_keywords = card_keywords_vi(clean_card, clean_orientation, suit)
    while len(chosen_keywords) < 3:
        chosen_keywords.append(chosen_keywords[-1])

    iso_day = (target_date or date.today()).isoformat()
    seed = f"{clean_card}|{clean_orientation}|{iso_day}"

    template_pool = (
        _AFFIRMATION_TEMPLATES_REVERSED
        if clean_orientation == "reversed"
        else _AFFIRMATION_TEMPLATES_UPRIGHT
    )
    template = template_pool[_digest_index(seed + "|t", len(template_pool))]
    rotation = _digest_index(seed + "|k", len(chosen_keywords))
    rotated = chosen_keywords[rotation:] + chosen_keywords[:rotation]

    text = template.format(kw1=rotated[0], kw2=rotated[1], kw3=rotated[2 % len(rotated)])

    return {
        "card_name": clean_card,
        "orientation": clean_orientation,
        "date": iso_day,
        "keywords": rotated[:3],
        "affirmation": text,
        # `tone` là khóa style nội bộ (không hiển thị dạng prose) — giữ giá trị ổn định.
        "tone": "gentle" if clean_orientation == "reversed" else "uplifting",
    }
