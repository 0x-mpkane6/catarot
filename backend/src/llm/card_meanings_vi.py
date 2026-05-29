"""Kho ý nghĩa lá bài tarot bằng tiếng Việt.

Dùng chung cho:
- Câu trả lời dự phòng (deterministic fallback) của bộ sinh luận giải khi không
  có LLM, để phần "Diễn giải từng lá" có nghĩa thật thay vì câu chữ rỗng.
- Bộ sinh affirmation theo thẻ ngày.

Cố ý KHÔNG chứa các từ chủ đề như "sự nghiệp"/"tài chính"… ở keyword của lá, để
phần diễn giải mỗi lá độc lập với chủ đề câu hỏi (chủ đề được xử lý riêng).
"""
from __future__ import annotations

# Từ khóa ý nghĩa cho 22 lá Ẩn Chính (Major Arcana), tách theo chiều Xuôi/Ngược.
MAJOR_ARCANA_VI: dict[str, dict[str, list[str]]] = {
    "The Fool": {
        "upright": ["khởi đầu mới", "tự do", "niềm tin ngây thơ"],
        "reversed": ["liều lĩnh", "do dự", "thiếu chuẩn bị"],
    },
    "The Magician": {
        "upright": ["ý chí", "sáng tạo", "hành động chủ động"],
        "reversed": ["phân tán năng lượng", "thiếu tập trung", "tiềm năng bị bỏ phí"],
    },
    "The High Priestess": {
        "upright": ["trực giác", "lắng nghe nội tâm", "điều còn ẩn giấu"],
        "reversed": ["phớt lờ trực giác", "che giấu", "mất kết nối bên trong"],
    },
    "The Empress": {
        "upright": ["nuôi dưỡng", "sung túc", "sức sáng tạo"],
        "reversed": ["bỏ bê bản thân", "phụ thuộc", "bế tắc sáng tạo"],
    },
    "The Emperor": {
        "upright": ["kỷ luật", "cấu trúc", "vai trò dẫn dắt"],
        "reversed": ["cứng nhắc", "kiểm soát quá mức", "thiếu định hướng"],
    },
    "The Hierophant": {
        "upright": ["truyền thống", "học hỏi", "định hướng tinh thần"],
        "reversed": ["phá khuôn mẫu", "tự tìm lối riêng", "hoài nghi quy chuẩn"],
    },
    "The Lovers": {
        "upright": ["kết nối", "lựa chọn từ trái tim", "sự hòa hợp"],
        "reversed": ["lệch giá trị", "mâu thuẫn", "do dự trong gắn kết"],
    },
    "The Chariot": {
        "upright": ["quyết tâm", "làm chủ hướng đi", "vượt lên"],
        "reversed": ["mất kiểm soát", "thiếu tập trung", "giằng co nội tâm"],
    },
    "Strength": {
        "upright": ["can đảm dịu dàng", "kiên nhẫn", "làm chủ cảm xúc"],
        "reversed": ["tự nghi ngờ", "nóng vội", "kiệt sức"],
    },
    "The Hermit": {
        "upright": ["hướng nội", "chiêm nghiệm", "đi tìm sự thật"],
        "reversed": ["cô lập", "lảng tránh", "lạc lối"],
    },
    "Wheel of Fortune": {
        "upright": ["chu kỳ", "bước ngoặt", "vận may xoay chuyển"],
        "reversed": ["trì trệ", "kháng cự thay đổi", "xui rủi tạm thời"],
    },
    "Justice": {
        "upright": ["công bằng", "sự thật", "trách nhiệm"],
        "reversed": ["thiên lệch", "né tránh hậu quả", "thiếu trung thực"],
    },
    "The Hanged Man": {
        "upright": ["tạm dừng", "đổi góc nhìn", "buông bỏ đúng lúc"],
        "reversed": ["trì hoãn", "mắc kẹt", "hy sinh vô ích"],
    },
    "Death": {
        "upright": ["kết thúc để tái sinh", "chuyển hóa", "buông cái cũ"],
        "reversed": ["níu kéo", "sợ thay đổi", "chuyển tiếp dang dở"],
    },
    "Temperance": {
        "upright": ["cân bằng", "điều hòa", "kiên nhẫn dung hòa"],
        "reversed": ["thái quá", "mất cân bằng", "thiếu kiên nhẫn"],
    },
    "The Devil": {
        "upright": ["ràng buộc", "cám dỗ", "sự lệ thuộc"],
        "reversed": ["giải thoát", "nhận ra xiềng xích", "lấy lại tự do"],
    },
    "The Tower": {
        "upright": ["biến động bất ngờ", "vỡ lẽ", "làm lại nền tảng"],
        "reversed": ["níu giữ cái mục ruỗng", "sợ đổ vỡ", "khủng hoảng bị trì hoãn"],
    },
    "The Star": {
        "upright": ["hy vọng", "chữa lành", "niềm tin được phục hồi"],
        "reversed": ["nản lòng", "mất phương hướng", "cạn niềm tin"],
    },
    "The Moon": {
        "upright": ["trực giác", "điều mơ hồ", "nỗi sợ tiềm ẩn"],
        "reversed": ["vén màn ảo tưởng", "dần sáng tỏ", "giải tỏa lo âu"],
    },
    "The Sun": {
        "upright": ["niềm vui", "sự rõ ràng", "sức sống"],
        "reversed": ["lạc quan gượng ép", "niềm vui bị che mờ", "thành công bị trì hoãn"],
    },
    "Judgement": {
        "upright": ["thức tỉnh", "đánh giá lại", "tiếng gọi bên trong"],
        "reversed": ["tự trách", "lưỡng lự", "phớt lờ bài học"],
    },
    "The World": {
        "upright": ["hoàn tất", "trọn vẹn", "thành tựu"],
        "reversed": ["còn dang dở", "thiếu khép lại", "mục tiêu bị trì hoãn"],
    },
}

# Chủ đề theo chất bài (suit) cho các lá Ẩn Phụ (Minor Arcana).
SUIT_THEMES_VI: dict[str, list[str]] = {
    "Cups": ["cảm xúc", "tình cảm", "trực giác"],
    "Wands": ["đam mê", "năng lượng", "hành động"],
    "Swords": ["lý trí", "sự thật", "quyết định"],
    "Pentacles": ["sự ổn định", "vật chất", "gây dựng lâu dài"],
}

_DEFAULT_KEYWORDS_VI: list[str] = ["sự hiện diện", "niềm tin", "sự rõ ràng"]

# Hậu tố theo vị trí trải bài, giúp câu diễn giải gắn với mạch quá khứ/hiện tại/tương lai.
_POSITION_SUFFIX_VI: dict[str, str] = {
    "past": "nền tảng đã định hình tình thế hiện tại",
    "present": "năng lượng đang chi phối bạn ngay lúc này",
    "future": "xu hướng đang dần mở ra phía trước",
    "single": "thông điệp tổng thể dành cho bạn",
}


def _normalize_orientation(orientation: str | None) -> str:
    return "reversed" if str(orientation or "upright").lower() == "reversed" else "upright"


def card_keywords_vi(
    card_name: str,
    orientation: str = "upright",
    suit: str | None = None,
) -> list[str]:
    """Trả về 3 từ khóa tiếng Việt cho lá bài theo chiều Xuôi/Ngược."""
    name = (card_name or "").strip()
    key_orientation = _normalize_orientation(orientation)

    entry = MAJOR_ARCANA_VI.get(name)
    if entry:
        keywords = list(entry.get(key_orientation) or entry.get("upright") or [])
    elif suit and suit in SUIT_THEMES_VI:
        keywords = list(SUIT_THEMES_VI[suit])
    else:
        keywords = list(_DEFAULT_KEYWORDS_VI)

    while len(keywords) < 3:
        keywords.append(keywords[-1] if keywords else "sự rõ ràng")
    return keywords[:3]


def card_meaning_phrase_vi(
    card_name: str,
    orientation: str = "upright",
    position: str = "single",
    suit: str | None = None,
) -> str:
    """Câu diễn giải tiếng Việt cho một lá ở một vị trí cụ thể (dùng cho fallback)."""
    keywords = card_keywords_vi(card_name, orientation, suit)
    key_orientation = _normalize_orientation(orientation)
    position_key = str(position or "single").lower()
    suffix = _POSITION_SUFFIX_VI.get(position_key, _POSITION_SUFFIX_VI["single"])

    opener = "ở chiều ngược, lá này nhấn vào" if key_orientation == "reversed" else "lá này gợi mở"
    kw1, kw2, kw3 = keywords[0], keywords[1], keywords[2]
    return f"{opener} {kw1}, {kw2} và {kw3} — {suffix}."
