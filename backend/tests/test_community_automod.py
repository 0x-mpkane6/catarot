"""Unit test cho bot tự kiểm duyệt cộng đồng (community_automod).

Bot này TỰ ĐỘNG approve/reject bài viết nên là code nhạy cảm: một thay đổi nhỏ ở
regex từ cấm hay ngưỡng tin cậy có thể khiến bot duyệt nhầm nội dung độc hại. Trước
đây module hoàn toàn không có test. Bộ test dưới đây khoá chặt các bất biến an toàn:

- Lớp quy tắc (_rule_prefilter): từ cấm → reject; link/sđt/promo → escalate.
- Ngưỡng (_apply_thresholds): mặc định KHÔNG tự reject; approve cần đủ tin cậy.
- Quyết định cuối (classify_post): LLM lỗi/tắt → KHÔNG BAO GIỜ tự approve.

Không cần DB hay LLM thật: các hàm là logic thuần; lời gọi Gemini được mock.
Chạy: pytest tests/test_community_automod.py -v  (từ thư mục backend/)
"""
from __future__ import annotations

import pytest

from src.advanced import community_automod as automod
from src.advanced.community_automod import (
    DECISION_APPROVE,
    DECISION_ESCALATE,
    DECISION_REJECT,
)

NORMAL_QUESTION = "Tuần này chuyện tình cảm của tôi sẽ ra sao?"


# ----------------------------------------------------------------------------
# Lớp 1 — _rule_prefilter (tiền lọc bằng quy tắc, chạy trước LLM)
# ----------------------------------------------------------------------------

def test_prefilter_escalates_question_too_short():
    # Arrange
    question = "hi"  # < _MIN_LEN (5)

    # Act
    result = automod._rule_prefilter(question, question)

    # Assert
    assert result is not None
    assert result["decision"] == DECISION_ESCALATE
    assert "low_quality" in result["categories"]


def test_prefilter_escalates_question_too_long():
    # Arrange
    question = "a" * 2001  # > _MAX_LEN (2000)

    # Act
    result = automod._rule_prefilter(question, question)

    # Assert
    assert result is not None
    assert result["decision"] == DECISION_ESCALATE


def test_prefilter_rejects_hard_block_profanity_english():
    # Arrange — từ cấm tiếng Anh có biên từ rõ ràng.
    question = "this is a long enough question text"
    content = "fuck you everyone here"

    # Act
    result = automod._rule_prefilter(question, content)

    # Assert
    assert result is not None
    assert result["decision"] == DECISION_REJECT
    assert result["confidence"] >= 0.9
    assert "hate_or_profanity" in result["categories"]


def test_prefilter_rejects_hard_block_profanity_vietnamese():
    # Arrange — từ cấm tiếng Việt, neo bằng khoảng trắng.
    question = "câu hỏi đủ dài để qua ngưỡng độ dài"
    content = "thằng kia địt mẹ mày"

    # Act
    result = automod._rule_prefilter(question, content)

    # Assert
    assert result is not None
    assert result["decision"] == DECISION_REJECT


def test_prefilter_does_not_false_positive_on_substring():
    # Arrange — 'rape' nằm trong 'grapes' KHÔNG được tính là từ cấm (biên \b).
    question = "I love grapes and drape my window every morning today"
    content = question

    # Act
    result = automod._rule_prefilter(question, content)

    # Assert — không có tín hiệu nào → đẩy lên LLM (None).
    assert result is None


def test_prefilter_escalates_on_url():
    # Arrange
    question = "Xem giúp mình lá bài này với nhé mọi người ơi"
    content = f"{question} ghé http://spam.example.com nhé"

    # Act
    result = automod._rule_prefilter(question, content)

    # Assert
    assert result is not None
    assert result["decision"] == DECISION_ESCALATE
    assert "spam_or_pii" in result["categories"]


def test_prefilter_escalates_on_phone_number():
    # Arrange
    question = "Mình cần tư vấn về công việc sắp tới ạ"
    content = f"{question} liên hệ 0912345678"

    # Act
    result = automod._rule_prefilter(question, content)

    # Assert
    assert result is not None
    assert result["decision"] == DECISION_ESCALATE
    assert "spam_or_pii" in result["categories"]


def test_prefilter_escalates_on_promo_keyword():
    # Arrange — quảng cáo không kèm URL (zalo) vẫn phải bị gắn cờ.
    question = "Bạn nào muốn xem bói không nhỉ"
    content = f"{question} nhắn zalo mình nhé, giảm giá 50%"

    # Act
    result = automod._rule_prefilter(question, content)

    # Assert
    assert result is not None
    assert result["decision"] == DECISION_ESCALATE
    assert "promo_spam" in result["categories"]


def test_prefilter_passes_clean_normal_question_to_llm():
    # Act
    result = automod._rule_prefilter(NORMAL_QUESTION, NORMAL_QUESTION)

    # Assert — câu hỏi tarot bình thường → không có quyết định rule (cần LLM).
    assert result is None


# ----------------------------------------------------------------------------
# Lớp ngưỡng — _apply_thresholds (kết quả phân loại → hành động thực thi)
# ----------------------------------------------------------------------------

def test_thresholds_approve_when_confidence_meets_default(monkeypatch):
    # Arrange — có tín hiệu rule (llm_only=False) nên dùng ngưỡng mặc định 0.75.
    monkeypatch.delenv("COMMUNITY_AUTOMOD_APPROVE_MIN_CONFIDENCE", raising=False)
    result = {"decision": DECISION_APPROVE, "confidence": 0.80, "llm_only": False}

    # Act / Assert
    assert automod._apply_thresholds(result) == DECISION_APPROVE


def test_thresholds_downgrade_approve_below_confidence(monkeypatch):
    # Arrange
    monkeypatch.delenv("COMMUNITY_AUTOMOD_APPROVE_MIN_CONFIDENCE", raising=False)
    result = {"decision": DECISION_APPROVE, "confidence": 0.50, "llm_only": False}

    # Act / Assert — chưa đủ tin cậy → escalate cho người xem.
    assert automod._apply_thresholds(result) == DECISION_ESCALATE


def test_thresholds_llm_only_approve_requires_higher_bar(monkeypatch):
    # Arrange — chỉ có LLM (không tín hiệu rule) → ngưỡng nâng lên 0.85.
    monkeypatch.delenv("COMMUNITY_AUTOMOD_APPROVE_MIN_CONFIDENCE", raising=False)
    just_below = {"decision": DECISION_APPROVE, "confidence": 0.80, "llm_only": True}
    well_above = {"decision": DECISION_APPROVE, "confidence": 0.92, "llm_only": True}

    # Act / Assert
    assert automod._apply_thresholds(just_below) == DECISION_ESCALATE
    assert automod._apply_thresholds(well_above) == DECISION_APPROVE


def test_thresholds_reject_is_escalated_when_autoreject_disabled(monkeypatch):
    # Arrange — mặc định KHÔNG tự chối: reject của bot chỉ gắn cờ cho người xem.
    monkeypatch.delenv("COMMUNITY_AUTOMOD_AUTOREJECT", raising=False)
    result = {"decision": DECISION_REJECT, "confidence": 0.99, "llm_only": False}

    # Act / Assert
    assert automod._apply_thresholds(result) == DECISION_ESCALATE


def test_thresholds_reject_applies_only_when_autoreject_enabled(monkeypatch):
    # Arrange
    monkeypatch.setenv("COMMUNITY_AUTOMOD_AUTOREJECT", "true")
    monkeypatch.delenv("COMMUNITY_AUTOMOD_REJECT_MIN_CONFIDENCE", raising=False)
    high = {"decision": DECISION_REJECT, "confidence": 0.95, "llm_only": False}
    low = {"decision": DECISION_REJECT, "confidence": 0.60, "llm_only": False}

    # Act / Assert — bật AUTOREJECT + đủ tin cậy → reject; thiếu tin cậy → escalate.
    assert automod._apply_thresholds(high) == DECISION_REJECT
    assert automod._apply_thresholds(low) == DECISION_ESCALATE


def test_thresholds_escalate_passes_through():
    # Act / Assert
    assert automod._apply_thresholds({"decision": DECISION_ESCALATE, "confidence": 0.4}) == DECISION_ESCALATE


# ----------------------------------------------------------------------------
# Quyết định cuối — classify_post (kết hợp rule + LLM)
# ----------------------------------------------------------------------------

def test_classify_never_approves_when_llm_unavailable(monkeypatch):
    # Arrange — LLM bật nhưng gọi lỗi (trả None). Câu hỏi sạch (prefilter=None).
    monkeypatch.setenv("COMMUNITY_AUTOMOD_LLM", "true")
    monkeypatch.setattr(automod, "_gemini_classify", lambda text: None)

    # Act
    result = automod.classify_post(question_text=NORMAL_QUESTION)

    # Assert — BẤT BIẾN AN TOÀN: không bao giờ tự approve khi không gọi được LLM.
    assert result["decision"] == DECISION_ESCALATE
    assert result["decision"] != DECISION_APPROVE


def test_classify_never_approves_when_llm_disabled(monkeypatch):
    # Arrange — tắt LLM, câu hỏi sạch → không có rule nào → escalate.
    monkeypatch.setenv("COMMUNITY_AUTOMOD_LLM", "false")

    # Act
    result = automod.classify_post(question_text=NORMAL_QUESTION)

    # Assert
    assert result["decision"] == DECISION_ESCALATE


def test_classify_rule_reject_short_circuits_before_llm(monkeypatch):
    # Arrange — từ cấm rõ ràng. Dù mock LLM cố tình approve, rule reject vẫn thắng.
    monkeypatch.setenv("COMMUNITY_AUTOMOD_LLM", "true")
    monkeypatch.setattr(
        automod,
        "_gemini_classify",
        lambda text: {"decision": DECISION_APPROVE, "confidence": 0.99, "reason": "", "categories": []},
    )

    # Act
    result = automod.classify_post(question_text="đây là một câu hỏi đủ dài fuck you")

    # Assert
    assert result["decision"] == DECISION_REJECT
    assert result["source"] == "rule"


def test_classify_keeps_escalate_when_rule_suspicious_but_llm_approves(monkeypatch):
    # Arrange — prefilter nghi ngờ (có sđt) nhưng LLM lại approve → giữ an toàn (escalate).
    monkeypatch.setenv("COMMUNITY_AUTOMOD_LLM", "true")
    monkeypatch.setattr(
        automod,
        "_gemini_classify",
        lambda text: {"decision": DECISION_APPROVE, "confidence": 0.99, "reason": "ok", "categories": []},
    )

    # Act
    result = automod.classify_post(question_text="Cần tư vấn công việc, gọi mình 0912345678")

    # Assert
    assert result["decision"] == DECISION_ESCALATE


def test_classify_downgrades_llm_approve_with_risk_flags(monkeypatch):
    # Arrange — LLM approve nhưng tự gắn cờ categories → escalate, không approve.
    monkeypatch.setenv("COMMUNITY_AUTOMOD_LLM", "true")
    monkeypatch.setattr(
        automod,
        "_gemini_classify",
        lambda text: {
            "decision": DECISION_APPROVE,
            "confidence": 0.95,
            "reason": "có chút lo ngại",
            "categories": ["harassment"],
        },
    )

    # Act
    result = automod.classify_post(question_text=NORMAL_QUESTION)

    # Assert
    assert result["decision"] == DECISION_ESCALATE


def test_classify_allows_clean_llm_approve(monkeypatch):
    # Arrange — câu hỏi sạch, LLM approve tự tin, không gắn cờ → approve (llm_only).
    monkeypatch.setenv("COMMUNITY_AUTOMOD_LLM", "true")
    monkeypatch.setattr(
        automod,
        "_gemini_classify",
        lambda text: {"decision": DECISION_APPROVE, "confidence": 0.95, "reason": "an toàn", "categories": []},
    )

    # Act
    result = automod.classify_post(question_text=NORMAL_QUESTION)

    # Assert
    assert result["decision"] == DECISION_APPROVE
    assert result["llm_only"] is True


def test_classify_always_returns_safe_dict_shape(monkeypatch):
    # Arrange
    monkeypatch.setenv("COMMUNITY_AUTOMOD_LLM", "true")
    monkeypatch.setattr(automod, "_gemini_classify", lambda text: None)

    # Act
    result = automod.classify_post(question_text="")

    # Assert — luôn trả dict có decision hợp lệ (mặc định an toàn).
    assert result["decision"] in {DECISION_APPROVE, DECISION_REJECT, DECISION_ESCALATE}
    assert "confidence" in result
