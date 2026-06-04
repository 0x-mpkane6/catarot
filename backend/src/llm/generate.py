from __future__ import annotations

import json
import os
import re
import unicodedata
from typing import Any

import requests
from src.llm.card_meanings_vi import card_meaning_phrase_vi
from src.utils.config import resolve_path
from src.utils.logging import get_logger

LOGGER = get_logger(__name__)
TOKEN_RE = re.compile(r"[a-z0-9_]+", re.IGNORECASE)


def _strip_diacritics(text: str) -> str:
    """Bỏ dấu tiếng Việt để keyword matching không phụ thuộc dấu."""
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in nfkd if not unicodedata.combining(ch))


def _normalize_text(text: str) -> str:
    """Lowercase + strip + bỏ dấu để khớp keyword (vd: 'Tình cảm' → 'tinh cam')."""
    return _strip_diacritics(text.lower()).strip()


def _detect_theme(question: str, transcript: str | None) -> str:
    text = _normalize_text(" ".join([question or "", transcript or ""]))
    tokens = set(TOKEN_RE.findall(text))

    love_keywords = {
        "love",
        "relationship",
        "romance",
        "dating",
        "tinh yeu",
        "tinh cam",
        "nguoi yeu",
        "hon nhan",
        "vo chong",
        "crush",
    }
    career_keywords = {
        "career",
        "job",
        "work",
        "promotion",
        "business",
        "su nghiep",
        "cong viec",
        "thang tien",
        "du an",
        "nghe nghiep",
    }
    finance_keywords = {
        "money",
        "finance",
        "income",
        "debt",
        "investment",
        "tai chinh",
        "tien",
        "thu nhap",
        "dau tu",
    }
    health_keywords = {
        "health",
        "wellness",
        "stress",
        "body",
        "suc khoe",
        "benh",
        "tam ly",
    }
    study_keywords = {
        "study",
        "exam",
        "learning",
        "hoc",
        "thi",
        "truong",
        "ky nang",
    }

    def has_any(keywords: set[str]) -> bool:
        for keyword in keywords:
            normalized_keyword = _normalize_text(keyword)
            if " " in normalized_keyword:
                if normalized_keyword in text:
                    return True
            elif normalized_keyword in tokens:
                return True
        return False

    if has_any(love_keywords):
        return "love"
    if has_any(career_keywords):
        return "career"
    if has_any(finance_keywords):
        return "finance"
    if has_any(health_keywords):
        return "health"
    if has_any(study_keywords):
        return "study"
    return "general"


_POSITION_VI: dict[str, str] = {
    "past": "Quá khứ",
    "present": "Hiện tại",
    "future": "Tương lai",
    "single": "Tổng thể",
}


def _position_label(position: str) -> str:
    return _POSITION_VI.get((position or "single").lower(), "Tổng thể")


def _advice_line(theme: str, position: str, orientation: str, card_name: str) -> str:
    position_key = (position or "single").lower()
    orientation_key = (orientation or "upright").lower()

    theme_actions: dict[str, dict[str, str]] = {
        "love": {
            "past": "nhìn lại một mâu thuẫn cũ và ghi rõ điều bạn không muốn lặp lại.",
            "present": "mở một cuộc nói chuyện thẳng thắn về nhu cầu tình cảm trong tuần này.",
            "future": "đặt một tiêu chuẩn mới cho mối quan hệ và hành động theo tiêu chuẩn đó.",
            "single": "ưu tiên giao tiếp chân thành và đặt ranh giới tình cảm rõ ràng.",
        },
        "career": {
            "past": "tổng kết một bài học từ dự án cũ để tránh lặp lại sai sót.",
            "present": "chọn mục tiêu công việc quan trọng nhất và làm ngay trong 24 giờ tới.",
            "future": "chuẩn bị một bước nâng cấp kỹ năng để mở rộng cơ hội thăng tiến.",
            "single": "tập trung vào một kết quả nghề nghiệp đo lường được trong 7 ngày.",
        },
        "finance": {
            "past": "rà soát một khoản chi có thể cắt giảm mà không ảnh hưởng lớn đến chất lượng sống.",
            "present": "lập ngân sách đơn giản cho 7 ngày tới và bám sát.",
            "future": "đặt mục tiêu tiết kiệm nhỏ nhưng đều, ưu tiên tính bền vững.",
            "single": "kiểm soát dòng tiền hằng ngày và tránh quyết định tài chính vội vàng.",
        },
        "health": {
            "past": "nhận diện một thói quen cũ làm giảm năng lượng và thay thế dần.",
            "present": "giữ lịch ngủ ổn định và vận động nhẹ mỗi ngày.",
            "future": "thiết lập kế hoạch chăm sóc sức khoẻ có thể duy trì lâu dài.",
            "single": "ưu tiên phục hồi năng lượng trước khi tăng tải.",
        },
        "study": {
            "past": "xem lại cách học cũ, giữ điều hiệu quả và bỏ điều gây xao nhãng.",
            "present": "dùng phiên học 25-30 phút để hoàn thành một mục tiêu rõ ràng mỗi ngày.",
            "future": "lập kế hoạch ôn tập sớm cho cột mốc sắp tới.",
            "single": "duy trì nhịp học đều thay vì học dồn vào phút cuối.",
        },
        "general": {
            "past": "rút ra một bài học cũ then chốt để làm điểm tựa cho tuần này.",
            "present": "chọn một hành động nhỏ nhưng cụ thể và bắt đầu ngay hôm nay.",
            "future": "xây dựng bước tiếp theo để giữ đà tiến triển ổn định.",
            "single": "giữ nhịp độ đều và theo dõi tiến độ mỗi ngày.",
        },
    }

    action_map = theme_actions.get(theme, theme_actions["general"])
    base = action_map.get(position_key, action_map["single"])
    label = _position_label(position_key)
    suffix = (
        " Đồng thời chậm lại một nhịp để tránh quyết định vội."
        if orientation_key == "reversed"
        else ""
    )
    return f"{label} — **{card_name}**: {base}{suffix}"


def _mask_secret(value: str) -> str:
    """Return a key-safe representation suitable for logging."""
    if not value:
        return "<empty>"
    if len(value) <= 8:
        return "***"
    return f"{value[:4]}...{value[-4:]}"


class ReadingGenerator:
    def __init__(self, prompts_dir: str = "./src/llm/prompts", model: str = "gpt-4o-mini") -> None:
        self.prompts_dir = resolve_path(prompts_dir)
        self.model = model
        self.last_used_model: str | None = None
        self.api_key = os.getenv("OPENAI_API_KEY", "").strip()

        # Google Gemini (free tier, preferred)
        # Hỗ trợ NHIỀU key Gemini (xoay vòng khi 1 key hết quota/429). Gộp GEMINI_API_KEYS
        # (phân tách dấu phẩy) + GEMINI_API_KEY (1 key), khử trùng lặp, giữ thứ tự.
        _gemini_raw = os.getenv("GEMINI_API_KEYS", "") + "," + os.getenv("GEMINI_API_KEY", "")
        _seen_keys: set[str] = set()
        self.gemini_api_keys: list[str] = []
        for _k in _gemini_raw.split(","):
            _k = _k.strip()
            if _k and _k not in _seen_keys:
                _seen_keys.add(_k)
                self.gemini_api_keys.append(_k)
        self.gemini_api_key = self.gemini_api_keys[0] if self.gemini_api_keys else ""
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
        try:
            self.gemini_temperature = float(os.getenv("GEMINI_TEMPERATURE", "0.6"))
        except ValueError:
            self.gemini_temperature = 0.6
        try:
            self.gemini_timeout = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "60"))
        except ValueError:
            self.gemini_timeout = 60.0
        # Token đầu ra. Mặc định 0 = KHÔNG giới hạn: bỏ hẳn field maxOutputTokens để
        # Gemini sinh tới mức tối đa của model → bài luận giải không bao giờ bị cắt giữa
        # câu. Đặt GEMINI_MAX_OUTPUT_TOKENS > 0 nếu sau này muốn áp lại một mức trần.
        try:
            self.gemini_max_output_tokens = int(
                os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "0")
            )
        except ValueError:
            self.gemini_max_output_tokens = 0

        self.ollama_enabled = os.getenv("OLLAMA_ENABLED", "true").strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
        }
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
        self.ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:3b-instruct")
        self.ollama_timeout = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))
        # Groq (cloud free, OpenAI-compatible) — backup chính khi mọi key Gemini hết quota.
        self.groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
        self.groq_model = (
            os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
            or "llama-3.3-70b-versatile"
        )
        try:
            self.groq_timeout = float(os.getenv("GROQ_TIMEOUT_SECONDS", "60"))
        except ValueError:
            self.groq_timeout = 60.0
        self.system_prompt = self._read_prompt("system.md")
        self.reading_template = self._read_prompt("reading_template.md")

    def _read_prompt(self, filename: str) -> str:
        path = self.prompts_dir / filename
        if not path.exists():
            return ""
        return path.read_text(encoding="utf-8")

    def _build_user_prompt(
        self,
        question: str,
        transcript: str | None,
        spread_type: str,
        cards: list[dict],
        rag_snippets: list[dict],
        emotion_state: str | None,
        warnings: list[str],
        image_low_confidence: bool = False,
    ) -> str:
        # Bỏ các cảnh báo KHÔNG liên quan nhận diện ảnh khỏi prompt (rút ngẫu nhiên, chưa có
        # ảnh, kiểu trải bài...) để LLM không tự nhắc "chụp lại ảnh" hay tiết lộ lá bài là ngẫu nhiên.
        _skip = ("ngẫu nhiên", "Chưa có ảnh", "đã bị bỏ qua", "trải bài three")
        prompt_warnings = [w for w in warnings if not any(k in w for k in _skip)]
        prompt = self.reading_template.format(
            question=question,
            transcript=transcript or "null",
            spread_type=spread_type,
            cards_json=json.dumps(cards, ensure_ascii=False),
            snippets_json=json.dumps(rag_snippets, ensure_ascii=False),
            warnings_json=json.dumps(prompt_warnings, ensure_ascii=False),
        )
        # Cờ xác định việc có thêm mục "### Lưu ý" hay không (thay vì để LLM tự đoán).
        if image_low_confidence:
            prompt += (
                "\n\nGHI CHÚ HỆ THỐNG: độ nhận diện lá bài từ ẢNH thấp. Hãy thêm một mục "
                "`### Lưu ý` ngắn gọn nhắc người dùng thử chụp lại ảnh rõ nét hơn."
            )
        else:
            prompt += (
                "\n\nGHI CHÚ HỆ THỐNG: KHÔNG thêm mục `### Lưu ý`; KHÔNG nhắc tới độ tin cậy "
                "nhận diện, lá bài ngẫu nhiên, hay việc chụp lại ảnh."
            )
        if emotion_state:
            prompt += (
                "\n\nAdditional Context:\n"
                f"- emotion_state: {emotion_state}\n"
                "- Please keep tone empathetic and non-judgmental for this emotional state."
            )
        return prompt

    def _generate_groq(self, system_prompt: str, user_prompt: str) -> str:
        """Groq cloud (OpenAI-compatible) — backup khi mọi key Gemini hết quota."""
        if not self.groq_api_key:
            raise RuntimeError("Groq API key not configured")
        payload: dict[str, Any] = {
            "model": self.groq_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": self.gemini_temperature,
        }
        if self.gemini_max_output_tokens > 0:
            payload["max_tokens"] = self.gemini_max_output_tokens
        try:
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json=payload,
                timeout=self.groq_timeout,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.groq_api_key}",
                },
            )
        except requests.exceptions.RequestException as exc:
            raise RuntimeError(f"Groq network error: {exc}") from exc
        if not response.ok:
            raw = response.text or ""
            scrubbed = raw.replace(self.groq_api_key, "<redacted>") if self.groq_api_key else raw
            raise RuntimeError(f"Groq HTTP {response.status_code}: {scrubbed[:300]}")
        data = response.json()
        choices = data.get("choices") or []
        if not choices:
            return ""
        return str((choices[0].get("message") or {}).get("content", "")).strip()

    def _generate_groq_messages(self, messages: list[dict[str, str]]) -> str:
        """Groq cho hội thoại nhiều lượt (follow-up) — OpenAI-compatible, nhận thẳng mảng messages."""
        if not self.groq_api_key:
            raise RuntimeError("Groq API key not configured")
        payload: dict[str, Any] = {
            "model": self.groq_model,
            "messages": messages,
            "temperature": self.gemini_temperature,
        }
        if self.gemini_max_output_tokens > 0:
            payload["max_tokens"] = self.gemini_max_output_tokens
        try:
            response = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                json=payload,
                timeout=self.groq_timeout,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.groq_api_key}",
                },
            )
        except requests.exceptions.RequestException as exc:
            raise RuntimeError(f"Groq network error: {exc}") from exc
        if not response.ok:
            raw = response.text or ""
            scrubbed = raw.replace(self.groq_api_key, "<redacted>") if self.groq_api_key else raw
            raise RuntimeError(f"Groq HTTP {response.status_code}: {scrubbed[:300]}")
        data = response.json()
        choices = data.get("choices") or []
        if not choices:
            return ""
        return str((choices[0].get("message") or {}).get("content", "")).strip()

    def _generate_openai(self, system_prompt: str, user_prompt: str) -> str:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=self.api_key)
        response = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.5,
        )
        return response.choices[0].message.content or ""

    def _generate_openai_messages(self, messages: list[dict[str, str]]) -> str:
        from openai import OpenAI  # type: ignore

        client = OpenAI(api_key=self.api_key)
        response = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.5,
        )
        return response.choices[0].message.content or ""

    # =========================
    # Gemini (Google AI Studio)
    # =========================

    def _gemini_safety_settings(self) -> list[dict[str, str]]:
        return [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
        ]

    def _gemini_generation_config(self) -> dict[str, Any]:
        config: dict[str, Any] = {
            "temperature": self.gemini_temperature,
            "topP": 0.95,
            "topK": 40,
            "responseMimeType": "text/plain",
        }
        # Chỉ đặt trần khi > 0; mặc định 0 => bỏ qua => Gemini sinh tới max model (không cắt).
        if self.gemini_max_output_tokens > 0:
            config["maxOutputTokens"] = self.gemini_max_output_tokens
        return config

    def _gemini_extract_text(self, payload: dict[str, Any]) -> str:
        candidates = payload.get("candidates") or []
        if not candidates:
            return ""
        parts = (candidates[0].get("content") or {}).get("parts") or []
        chunks = [str(part.get("text", "")) for part in parts if isinstance(part, dict)]
        return "".join(chunks).strip()

    def _gemini_post(self, payload: dict[str, Any], api_key: str | None = None) -> str:
        key = (api_key or self.gemini_api_key or "").strip()
        if not key:
            raise RuntimeError("Gemini API key not configured")

        endpoint = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.gemini_model}:generateContent"
        )
        try:
            response = requests.post(
                endpoint,
                params={"key": key},
                json=payload,
                timeout=self.gemini_timeout,
                headers={"Content-Type": "application/json"},
            )
        except requests.exceptions.RequestException as exc:
            raise RuntimeError(f"Gemini network error: {exc}") from exc

        if not response.ok:
            raw_body = response.text or ""
            scrubbed = (
                raw_body.replace(key, "<redacted>")
                if key
                else raw_body
            )
            raise RuntimeError(f"Gemini HTTP {response.status_code}: {scrubbed[:300]}")

        return self._gemini_extract_text(response.json())

    def _generate_gemini(self, system_prompt: str, user_prompt: str, api_key: str | None = None) -> str:
        payload: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": self._gemini_generation_config(),
            "safetySettings": self._gemini_safety_settings(),
        }
        return self._gemini_post(payload, api_key=api_key)

    def _generate_gemini_messages(self, messages: list[dict[str, str]], api_key: str | None = None) -> str:
        system_text_parts: list[str] = []
        contents: list[dict[str, Any]] = []
        for row in messages:
            role = str(row.get("role") or "").strip().lower()
            content = str(row.get("content") or "").strip()
            if not content:
                continue
            if role == "system":
                system_text_parts.append(content)
                continue
            # Gemini uses "model" for assistant turns.
            gemini_role = "model" if role == "assistant" else "user"
            contents.append({"role": gemini_role, "parts": [{"text": content}]})

        payload: dict[str, Any] = {
            "contents": contents,
            "generationConfig": self._gemini_generation_config(),
            "safetySettings": self._gemini_safety_settings(),
        }
        if system_text_parts:
            payload["systemInstruction"] = {"parts": [{"text": "\n\n".join(system_text_parts)}]}
        return self._gemini_post(payload, api_key=api_key)

    def _extract_ollama_text(self, payload: dict[str, Any]) -> str:
        message = payload.get("message")
        if isinstance(message, dict):
            content = message.get("content")
            if isinstance(content, str):
                return content.strip()
        response = payload.get("response")
        if isinstance(response, str):
            return response.strip()
        return ""

    def _generate_ollama(self, system_prompt: str, user_prompt: str) -> str:
        chat_url = f"{self.ollama_base_url}/api/chat"
        chat_body = {
            "model": self.ollama_model,
            "stream": False,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        chat_response = requests.post(chat_url, json=chat_body, timeout=self.ollama_timeout)
        if chat_response.ok:
            return self._extract_ollama_text(chat_response.json())

        # Compatibility fallback for older Ollama HTTP handlers.
        if chat_response.status_code == 404:
            generate_url = f"{self.ollama_base_url}/api/generate"
            generate_body = {
                "model": self.ollama_model,
                "stream": False,
                "prompt": f"{system_prompt}\n\n{user_prompt}",
            }
            generate_response = requests.post(generate_url, json=generate_body, timeout=self.ollama_timeout)
            generate_response.raise_for_status()
            return self._extract_ollama_text(generate_response.json())

        chat_response.raise_for_status()
        return ""

    def _generate_ollama_messages(self, messages: list[dict[str, str]]) -> str:
        chat_url = f"{self.ollama_base_url}/api/chat"
        chat_body = {
            "model": self.ollama_model,
            "stream": False,
            "messages": messages,
        }
        chat_response = requests.post(chat_url, json=chat_body, timeout=self.ollama_timeout)
        if chat_response.ok:
            return self._extract_ollama_text(chat_response.json())

        if chat_response.status_code == 404:
            prompt_lines = []
            for row in messages:
                role = row.get("role", "user")
                content = row.get("content", "")
                prompt_lines.append(f"{role.upper()}: {content}")
            generate_url = f"{self.ollama_base_url}/api/generate"
            generate_body = {
                "model": self.ollama_model,
                "stream": False,
                "prompt": "\n\n".join(prompt_lines),
            }
            generate_response = requests.post(generate_url, json=generate_body, timeout=self.ollama_timeout)
            generate_response.raise_for_status()
            return self._extract_ollama_text(generate_response.json())

        chat_response.raise_for_status()
        return ""

    def _generate_fallback(
        self,
        question: str,
        transcript: str | None,
        cards: list[dict],
        rag_snippets: list[dict],
        warnings: list[str],
    ) -> str:
        lines: list[str] = []
        theme = _detect_theme(question, transcript)
        theme_label = {
            "love": "tình cảm",
            "career": "sự nghiệp",
            "finance": "tài chính",
            "health": "sức khoẻ",
            "study": "học tập",
            "general": "chung",
        }.get(theme, "chung")

        lines.append("## Tổng quan")
        lines.append(f"- Câu hỏi: *{question or 'Chưa có câu hỏi rõ ràng.'}*")
        lines.append(f"- Chủ đề chính: **{theme_label}**.")
        if transcript:
            lines.append(f"- Ngữ cảnh từ giọng nói: {transcript}")
        lines.append("")

        lines.append("### Diễn giải từng lá")
        if cards:
            for card in cards:
                name = str(card.get("name", "Unknown Card"))
                raw_orientation = str(card.get("orientation", "upright"))
                orientation_label = "Ngược" if raw_orientation.lower() == "reversed" else "Xuôi"
                raw_position = str(card.get("position", "single"))
                position = _position_label(raw_position)
                meaning = card_meaning_phrase_vi(
                    name, raw_orientation, raw_position, card.get("suit")
                )
                lines.append(
                    f"- **{name}** *({position} — {orientation_label})*: {meaning}"
                )
        else:
            lines.append(
                "- Chưa nhận diện được lá bài nào — hãy chụp lại ảnh hoặc bật chế độ random."
            )
        lines.append("")

        lines.append("### Lời khuyên 7 ngày")
        if cards:
            for idx, card in enumerate(cards[:3], start=1):
                position = str(card.get("position", "single"))
                name = str(card.get("name", "Unknown Card"))
                orientation = str(card.get("orientation", "upright"))
                lines.append(
                    f"{idx}. {_advice_line(theme, position, orientation, name)}"
                )
        else:
            for idx, position in enumerate(["past", "present", "future"], start=1):
                lines.append(
                    f"{idx}. {_advice_line(theme, position, 'upright', 'Định hướng chung')}"
                )

        if rag_snippets:
            lines.append("")
            lines.append("### Tư liệu tham khảo")
            for snippet in rag_snippets[:3]:
                snippet_text = str(snippet.get("text", "")).replace("\n", " ").strip()
                if snippet_text:
                    lines.append(f"- {snippet_text[:160]}…")

        if warnings:
            lines.append("")
            lines.append("### Lưu ý")
            lines.append("- Kết quả mang tính tham khảo, độ chắc chắn có thể chưa cao.")
            lines.append(
                "- Nếu cần, hãy chụp lại lá bài rõ hơn hoặc chọn lại từ danh sách gợi ý."
            )

        return "\n".join(lines)

    def generate(
        self,
        question: str,
        transcript: str | None,
        spread_type: str,
        cards: list[dict],
        rag_snippets: list[dict],
        emotion_state: str | None,
        warnings: list[str],
        image_low_confidence: bool = False,
    ) -> tuple[str, list[str]]:
        self.last_used_model = None
        extra_warnings: list[str] = []
        user_prompt = self._build_user_prompt(
            question=question,
            transcript=transcript,
            spread_type=spread_type,
            cards=cards,
            rag_snippets=rag_snippets,
            emotion_state=emotion_state,
            warnings=warnings,
            image_low_confidence=image_low_confidence,
        )

        if (
            not self.gemini_api_keys
            and not self.api_key
            and not self.groq_api_key
            and not self.ollama_enabled
        ):
            extra_warnings.append(
                "Chưa cấu hình mô hình ngôn ngữ (LLM); dùng câu trả lời dự phòng tự động."
            )
            self.last_used_model = "deterministic-fallback"
            return (
                self._generate_fallback(question, transcript, cards, rag_snippets, warnings),
                extra_warnings,
            )

        # Tier 1: Google Gemini (free) — XOAY VÒNG nhiều key khi lỗi/hết quota.
        for _idx, _key in enumerate(self.gemini_api_keys):
            try:
                answer = self._generate_gemini(self.system_prompt, user_prompt, api_key=_key)
                if answer.strip():
                    self.last_used_model = f"gemini:{self.gemini_model}"
                    return answer.strip(), extra_warnings
                extra_warnings.append("Gemini trả về nội dung rỗng; thử backend kế tiếp.")
                break  # rỗng (không phải hết quota) → sang tier khác, khỏi thử key kế
            except Exception as exc:
                LOGGER.warning(
                    "Gemini key #%d failed (model=%s): %s",
                    _idx + 1,
                    self.gemini_model,
                    exc,
                )
                if _idx < len(self.gemini_api_keys) - 1:
                    extra_warnings.append(
                        f"Gemini key #{_idx + 1} lỗi/hết quota; thử key kế tiếp."
                    )
                else:
                    extra_warnings.append(
                        "Gemini (mọi key) lỗi/hết quota; thử backend kế tiếp."
                    )

        # Tier 2: OpenAI
        if self.api_key:
            try:
                answer = self._generate_openai(self.system_prompt, user_prompt)
                if answer.strip():
                    self.last_used_model = f"openai:{self.model}"
                    return answer.strip(), extra_warnings
            except Exception as exc:
                LOGGER.warning("OpenAI generation failed: %s", exc)
                extra_warnings.append("OpenAI lỗi; thử backend kế tiếp.")

        # Tier 3: Groq (cloud free, OpenAI-compatible) — backup chính khi Gemini hết quota
        if self.groq_api_key:
            try:
                answer = self._generate_groq(self.system_prompt, user_prompt)
                if answer.strip():
                    self.last_used_model = f"groq:{self.groq_model}"
                    return answer.strip(), extra_warnings
            except Exception as exc:
                LOGGER.warning("Groq generation failed: %s", exc)
                extra_warnings.append("Groq lỗi; thử backend kế tiếp.")

        # Tier 4: Local Ollama
        if self.ollama_enabled:
            try:
                answer = self._generate_ollama(self.system_prompt, user_prompt)
                if answer.strip():
                    self.last_used_model = f"ollama:{self.ollama_model}"
                    return answer.strip(), extra_warnings
                extra_warnings.append("Ollama trả về nội dung rỗng; dùng mẫu trả lời dự phòng.")
            except Exception as exc:
                LOGGER.warning("Ollama generation failed: %s", exc)
                extra_warnings.append("Không kết nối được Ollama; chuyển sang câu trả lời dự phòng tự động.")

        self.last_used_model = "deterministic-fallback"
        return (
            self._generate_fallback(question, transcript, cards, rag_snippets, warnings),
            extra_warnings,
        )

    def generate_custom(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        fallback_text: str,
    ) -> tuple[str, list[str]]:
        """Chạy ĐÚNG chuỗi fallback hiện có cho một cặp (system, user) prompt tuỳ biến.

        Thứ tự: Gemini (xoay nhiều key) → OpenAI → Groq → Ollama → fallback_text
        (deterministic do caller dựng sẵn). KHÔNG gọi thẳng một provider đơn lẻ; tái
        dùng nguyên các method _generate_* của chuỗi chính. Set self.last_used_model
        đồng nhất với generate()/generate_followup().
        """
        self.last_used_model = None
        extra_warnings: list[str] = []

        if (
            not self.gemini_api_keys
            and not self.api_key
            and not self.groq_api_key
            and not self.ollama_enabled
        ):
            extra_warnings.append(
                "Chưa cấu hình mô hình ngôn ngữ (LLM); dùng luận giải dự phòng tự động."
            )
            self.last_used_model = "deterministic-fallback"
            return fallback_text, extra_warnings

        # Tier 1: Gemini — xoay vòng nhiều key khi lỗi/hết quota.
        for _idx, _key in enumerate(self.gemini_api_keys):
            try:
                answer = self._generate_gemini(system_prompt, user_prompt, api_key=_key)
                if answer.strip():
                    self.last_used_model = f"gemini:{self.gemini_model}"
                    return answer.strip(), extra_warnings
                extra_warnings.append("Gemini trả về nội dung rỗng; thử backend kế tiếp.")
                break
            except Exception as exc:
                LOGGER.warning(
                    "Gemini deep-reading key #%d failed (model=%s): %s",
                    _idx + 1,
                    self.gemini_model,
                    exc,
                )
                if _idx < len(self.gemini_api_keys) - 1:
                    extra_warnings.append(
                        f"Gemini key #{_idx + 1} lỗi/hết quota; thử key kế tiếp."
                    )
                else:
                    extra_warnings.append(
                        "Gemini (mọi key) lỗi/hết quota; thử backend kế tiếp."
                    )

        # Tier 2: OpenAI
        if self.api_key:
            try:
                answer = self._generate_openai(system_prompt, user_prompt)
                if answer.strip():
                    self.last_used_model = f"openai:{self.model}"
                    return answer.strip(), extra_warnings
            except Exception as exc:
                LOGGER.warning("OpenAI deep-reading generation failed: %s", exc)
                extra_warnings.append("OpenAI lỗi; thử backend kế tiếp.")

        # Tier 3: Groq (cloud free, OpenAI-compatible)
        if self.groq_api_key:
            try:
                answer = self._generate_groq(system_prompt, user_prompt)
                if answer.strip():
                    self.last_used_model = f"groq:{self.groq_model}"
                    return answer.strip(), extra_warnings
            except Exception as exc:
                LOGGER.warning("Groq deep-reading generation failed: %s", exc)
                extra_warnings.append("Groq lỗi; thử backend kế tiếp.")

        # Tier 4: Local Ollama
        if self.ollama_enabled:
            try:
                answer = self._generate_ollama(system_prompt, user_prompt)
                if answer.strip():
                    self.last_used_model = f"ollama:{self.ollama_model}"
                    return answer.strip(), extra_warnings
                extra_warnings.append("Ollama trả về nội dung rỗng; dùng luận giải dự phòng tự động.")
            except Exception as exc:
                LOGGER.warning("Ollama deep-reading generation failed: %s", exc)
                extra_warnings.append(
                    "Không kết nối được Ollama; chuyển sang luận giải dự phòng tự động."
                )

        self.last_used_model = "deterministic-fallback"
        return fallback_text, extra_warnings

    def _generate_followup_fallback(
        self,
        *,
        session_context: dict[str, Any],
        user_message: str,
    ) -> str:
        question = str(session_context.get("question") or "")
        cards = session_context.get("cards") or []
        primary_card = "Unknown Card"
        if isinstance(cards, list) and cards:
            first = cards[0]
            if isinstance(first, dict):
                primary_card = str(first.get("name") or "Unknown Card")

        return "\n".join(
            [
                "Cảm ơn bạn đã đặt câu hỏi tiếp theo.",
                f"Câu hỏi gốc: {question}",
                f"Lá bài nổi bật: {primary_card}",
                f"Câu hỏi tiếp theo của bạn: {user_message}",
                "Gợi ý: chọn một hành động cụ thể trong 24 giờ tới và theo dõi cảm nhận của bạn.",
            ]
        )

    def generate_followup(
        self,
        *,
        session_context: dict[str, Any],
        summary: str,
        recent_messages: list[dict[str, Any]],
        user_message: str,
    ) -> tuple[str, list[str]]:
        self.last_used_model = None
        extra_warnings: list[str] = []

        context_json = json.dumps(session_context, ensure_ascii=False)
        summary_text = summary or "(no older turns)"
        system_prompt = (
            f"{self.system_prompt}\n\n"
            "Bạn đang tiếp nối một phiên đọc tarot đã có. Hãy bám sát ngữ cảnh phiên, trả lời "
            "bằng tiếng Việt có dấu, ngắn gọn, đồng cảm và có thể hành động được.\n"
            f"NGU_CANH_PHIEN_JSON:\n{context_json}\n"
            f"TOM_TAT_LUOT_TRUOC:\n{summary_text}\n"
        )

        messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
        for row in recent_messages:
            role = str(row.get("role") or "").strip().lower()
            content = str(row.get("content") or "").strip()
            if role not in {"user", "assistant", "system"} or not content:
                continue
            messages.append({"role": role, "content": content})

        if not messages or messages[-1]["role"] != "user":
            messages.append({"role": "user", "content": user_message})

        if (
            not self.gemini_api_keys
            and not self.api_key
            and not self.groq_api_key
            and not self.ollama_enabled
        ):
            extra_warnings.append("Chưa cấu hình mô hình ngôn ngữ (LLM); dùng câu trả lời tiếp nối dự phòng tự động.")
            self.last_used_model = "deterministic-fallback"
            return (
                self._generate_followup_fallback(session_context=session_context, user_message=user_message),
                extra_warnings,
            )

        # Tier 1: Google Gemini — XOAY VÒNG nhiều key khi lỗi/hết quota (đồng nhất với generate()).
        for _idx, _key in enumerate(self.gemini_api_keys):
            try:
                answer = self._generate_gemini_messages(messages, api_key=_key)
                if answer.strip():
                    self.last_used_model = f"gemini:{self.gemini_model}"
                    return answer.strip(), extra_warnings
                extra_warnings.append("Gemini trả về nội dung tiếp nối rỗng; thử backend kế tiếp.")
                break  # rỗng (không phải hết quota) → sang tier khác, khỏi thử key kế
            except Exception as exc:
                LOGGER.warning(
                    "Gemini follow-up key #%d failed (model=%s): %s",
                    _idx + 1,
                    self.gemini_model,
                    exc,
                )
                if _idx < len(self.gemini_api_keys) - 1:
                    extra_warnings.append(
                        f"Gemini key #{_idx + 1} (tiếp nối) lỗi/hết quota; thử key kế tiếp."
                    )
                else:
                    extra_warnings.append(
                        "Gemini (mọi key, tiếp nối) lỗi/hết quota; thử backend kế tiếp."
                    )

        # Tier 2: OpenAI
        if self.api_key:
            try:
                answer = self._generate_openai_messages(messages)
                if answer.strip():
                    self.last_used_model = f"openai:{self.model}"
                    return answer.strip(), extra_warnings
            except Exception as exc:
                LOGGER.warning("OpenAI follow-up generation failed: %s", exc)
                extra_warnings.append("OpenAI lỗi; thử backend kế tiếp.")

        # Tier 3: Groq (cloud free, OpenAI-compatible) — backup chính khi mọi key Gemini hết quota.
        if self.groq_api_key:
            try:
                answer = self._generate_groq_messages(messages)
                if answer.strip():
                    self.last_used_model = f"groq:{self.groq_model}"
                    return answer.strip(), extra_warnings
            except Exception as exc:
                LOGGER.warning("Groq follow-up generation failed: %s", exc)
                extra_warnings.append("Groq (tiếp nối) lỗi; thử backend kế tiếp.")

        # Tier 4: Local Ollama
        if self.ollama_enabled:
            try:
                answer = self._generate_ollama_messages(messages)
                if answer.strip():
                    self.last_used_model = f"ollama:{self.ollama_model}"
                    return answer.strip(), extra_warnings
                extra_warnings.append("Ollama trả về nội dung tiếp nối rỗng; dùng dự phòng.")
            except Exception as exc:
                LOGGER.warning("Ollama follow-up generation failed: %s", exc)
                extra_warnings.append("Không kết nối được Ollama; chuyển sang câu trả lời tiếp nối dự phòng tự động.")

        self.last_used_model = "deterministic-fallback"
        return (
            self._generate_followup_fallback(session_context=session_context, user_message=user_message),
            extra_warnings,
        )
