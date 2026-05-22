from __future__ import annotations

import json
import os
import re
from typing import Any

import requests
from src.utils.config import resolve_path
from src.utils.logging import get_logger

LOGGER = get_logger(__name__)
TOKEN_RE = re.compile(r"[a-z0-9_]+", re.IGNORECASE)


def _normalize_text(text: str) -> str:
    return text.lower().strip()


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


def _advice_line(theme: str, position: str, orientation: str, card_name: str) -> str:
    position = (position or "single").lower()
    orientation = (orientation or "upright").lower()

    theme_actions: dict[str, dict[str, str]] = {
        "love": {
            "past": "nhin lai mot mau xung dot cu va ghi ro dieu ban khong muon lap lai.",
            "present": "mo cuoc noi chuyen thang than ve nhu cau tinh cam trong tuan nay.",
            "future": "dat 1 tieu chuan moi cho moi quan he va hanh dong theo tieu chuan do.",
            "single": "uu tien giao tiep chan thanh va dat ranh gioi tinh cam ro rang.",
        },
        "career": {
            "past": "tong ket 1 bai hoc tu du an cu de tranh lap lai sai sot.",
            "present": "chon 1 muc tieu cong viec quan trong nhat va lam ngay trong 24h.",
            "future": "chuan bi 1 buoc nang cap ky nang de mo rong co hoi thang tien.",
            "single": "tap trung vao 1 ket qua nghe nghiep co the do luong trong 7 ngay.",
        },
        "finance": {
            "past": "ra soat 1 khoan chi co the cat giam ma khong anh huong lon den chat luong song.",
            "present": "lap ngan sach don gian cho 7 ngay toi va bam sat.",
            "future": "dat muc tiet kiem nho nhung deu, uu tien tinh ben vung.",
            "single": "kiem soat dong tien hang ngay va tranh quyet dinh tai chinh voi.",
        },
        "health": {
            "past": "nhan dien 1 thoi quen cu lam giam nang luong va thay the dan.",
            "present": "giu lich ngu on dinh va van dong nhe moi ngay.",
            "future": "thiet lap ke hoach cham soc suc khoe co the duy tri lau dai.",
            "single": "uu tien phuc hoi nang luong truoc khi tang tai.",
        },
        "study": {
            "past": "xem lai cach hoc cu, giu lai dieu hieu qua va bo dieu gay xao nhang.",
            "present": "dung phien hoc 25-30 phut de hoan thanh 1 muc tieu ro rang moi ngay.",
            "future": "lap ke hoach on tap som cho cot moc sap toi.",
            "single": "duy tri nhip hoc deu thay vi hoc don vao phut cuoi.",
        },
        "general": {
            "past": "rut ra 1 bai hoc cu then chot de lam diem tua cho tuan nay.",
            "present": "chon 1 hanh dong nho nhung cu the va bat dau ngay hom nay.",
            "future": "xay dung buoc tiep theo de giu dong tien trien on dinh.",
            "single": "giu nhip do deu va theo doi tien do moi ngay.",
        },
    }

    action_map = theme_actions.get(theme, theme_actions["general"])
    base = action_map.get(position, action_map["single"])

    if orientation == "reversed":
        return f"- [{position}] {card_name}: {base} Dong thoi di cham lai mot nhip de tranh quyet dinh voi."
    return f"- [{position}] {card_name}: {base}"


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
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
        try:
            self.gemini_temperature = float(os.getenv("GEMINI_TEMPERATURE", "0.6"))
        except ValueError:
            self.gemini_temperature = 0.6
        try:
            self.gemini_timeout = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "60"))
        except ValueError:
            self.gemini_timeout = 60.0

        self.ollama_enabled = os.getenv("OLLAMA_ENABLED", "true").strip().lower() in {
            "1",
            "true",
            "yes",
            "on",
        }
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
        self.ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:3b-instruct")
        self.ollama_timeout = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))
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
    ) -> str:
        prompt = self.reading_template.format(
            question=question,
            transcript=transcript or "null",
            spread_type=spread_type,
            cards_json=json.dumps(cards, ensure_ascii=False),
            snippets_json=json.dumps(rag_snippets, ensure_ascii=False),
            warnings_json=json.dumps(warnings, ensure_ascii=False),
        )
        if emotion_state:
            prompt += (
                "\n\nAdditional Context:\n"
                f"- emotion_state: {emotion_state}\n"
                "- Please keep tone empathetic and non-judgmental for this emotional state."
            )
        return prompt

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
        return {
            "temperature": self.gemini_temperature,
            "topP": 0.95,
            "topK": 40,
            "maxOutputTokens": 1024,
            "responseMimeType": "text/plain",
        }

    def _gemini_extract_text(self, payload: dict[str, Any]) -> str:
        candidates = payload.get("candidates") or []
        if not candidates:
            return ""
        parts = (candidates[0].get("content") or {}).get("parts") or []
        chunks = [str(part.get("text", "")) for part in parts if isinstance(part, dict)]
        return "".join(chunks).strip()

    def _gemini_post(self, payload: dict[str, Any]) -> str:
        if not self.gemini_api_key:
            raise RuntimeError("Gemini API key not configured")

        endpoint = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.gemini_model}:generateContent"
        )
        try:
            response = requests.post(
                endpoint,
                params={"key": self.gemini_api_key},
                json=payload,
                timeout=self.gemini_timeout,
                headers={"Content-Type": "application/json"},
            )
        except requests.exceptions.RequestException as exc:
            raise RuntimeError(f"Gemini network error: {exc}") from exc

        if not response.ok:
            raw_body = response.text or ""
            scrubbed = (
                raw_body.replace(self.gemini_api_key, "<redacted>")
                if self.gemini_api_key
                else raw_body
            )
            raise RuntimeError(f"Gemini HTTP {response.status_code}: {scrubbed[:300]}")

        return self._gemini_extract_text(response.json())

    def _generate_gemini(self, system_prompt: str, user_prompt: str) -> str:
        payload: dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": self._gemini_generation_config(),
            "safetySettings": self._gemini_safety_settings(),
        }
        return self._gemini_post(payload)

    def _generate_gemini_messages(self, messages: list[dict[str, str]]) -> str:
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
        return self._gemini_post(payload)

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

        lines.append("### Tong quan")
        lines.append(f"- Cau hoi: {question}")
        lines.append(f"- Chu de chinh: {theme}")
        if transcript:
            lines.append(f"- Ngu canh tu audio: {transcript}")

        lines.append("")
        lines.append("### Dien giai theo tung la")
        if cards:
            for card in cards:
                position = card.get("position", "single")
                name = card.get("name", "Unknown Card")
                orientation = card.get("orientation", "upright")
                lines.append(f"- {position}: **{name}** ({orientation})")
        else:
            lines.append("- Chua co la bai duoc nhan dang.")

        lines.append("")
        lines.append("### Loi khuyen hanh dong (7 ngay)")
        if cards:
            for card in cards[:3]:
                position = card.get("position", "single")
                name = card.get("name", "Unknown Card")
                orientation = card.get("orientation", "upright")
                lines.append(_advice_line(theme, str(position), str(orientation), str(name)))
        else:
            lines.append(_advice_line(theme, "single", "upright", "General guidance"))
            lines.append(_advice_line(theme, "present", "upright", "General guidance"))
            lines.append(_advice_line(theme, "future", "upright", "General guidance"))

        if rag_snippets:
            lines.append("")
            lines.append("### Trich dan du lieu tham khao")
            for snippet in rag_snippets[:3]:
                snippet_text = str(snippet.get("text", "")).replace("\n", " ").strip()
                lines.append(f"- {snippet_text[:120]}...")

        if warnings:
            lines.append("")
            lines.append("### Luu y")
            lines.append("- Ket qua nay mang tinh tham khao va con do chua chac.")
            lines.append("- Neu can, chup lai la bai ro hon hoac chon lai card tu top goi y.")

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
        )

        if not self.gemini_api_key and not self.api_key and not self.ollama_enabled:
            extra_warnings.append(
                "No LLM backend configured; using deterministic fallback response."
            )
            self.last_used_model = "deterministic-fallback"
            return (
                self._generate_fallback(question, transcript, cards, rag_snippets, warnings),
                extra_warnings,
            )

        # Tier 1: Google Gemini (free tier)
        if self.gemini_api_key:
            try:
                answer = self._generate_gemini(self.system_prompt, user_prompt)
                if answer.strip():
                    self.last_used_model = f"gemini:{self.gemini_model}"
                    return answer.strip(), extra_warnings
                extra_warnings.append("Gemini returned empty content; trying next backend.")
            except Exception as exc:
                LOGGER.warning(
                    "Gemini generation failed (key=%s, model=%s): %s",
                    _mask_secret(self.gemini_api_key),
                    self.gemini_model,
                    exc,
                )
                extra_warnings.append("Gemini failed; trying next backend.")

        # Tier 2: OpenAI
        if self.api_key:
            try:
                answer = self._generate_openai(self.system_prompt, user_prompt)
                if answer.strip():
                    self.last_used_model = f"openai:{self.model}"
                    return answer.strip(), extra_warnings
            except Exception as exc:
                LOGGER.warning("OpenAI generation failed: %s", exc)
                extra_warnings.append("OpenAI failed; trying local Ollama.")

        # Tier 3: Local Ollama
        if self.ollama_enabled:
            try:
                answer = self._generate_ollama(self.system_prompt, user_prompt)
                if answer.strip():
                    self.last_used_model = f"ollama:{self.ollama_model}"
                    return answer.strip(), extra_warnings
                extra_warnings.append("Ollama returned empty content; using template fallback.")
            except Exception as exc:
                LOGGER.warning("Ollama generation failed: %s", exc)
                extra_warnings.append("Ollama unavailable; switched to deterministic fallback response.")

        self.last_used_model = "deterministic-fallback"
        return (
            self._generate_fallback(question, transcript, cards, rag_snippets, warnings),
            extra_warnings,
        )

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
                "Cam on ban da dat cau hoi tiep theo.",
                f"Cau hoi goc: {question}",
                f"La bai noi bat: {primary_card}",
                f"Follow-up cua ban: {user_message}",
                "Goi y: chon mot hanh dong cu the trong 24h toi va theo doi cam nhan cua ban.",
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
            "You are continuing an existing tarot session. "
            "Use the session context faithfully and keep answer concise, empathetic, and actionable.\n"
            f"SESSION_CONTEXT_JSON:\n{context_json}\n"
            f"OLDER_TURNS_SUMMARY:\n{summary_text}\n"
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

        if not self.gemini_api_key and not self.api_key and not self.ollama_enabled:
            extra_warnings.append("No LLM backend configured; using deterministic follow-up fallback response.")
            self.last_used_model = "deterministic-fallback"
            return (
                self._generate_followup_fallback(session_context=session_context, user_message=user_message),
                extra_warnings,
            )

        # Tier 1: Google Gemini
        if self.gemini_api_key:
            try:
                answer = self._generate_gemini_messages(messages)
                if answer.strip():
                    self.last_used_model = f"gemini:{self.gemini_model}"
                    return answer.strip(), extra_warnings
                extra_warnings.append("Gemini returned empty follow-up content; trying next backend.")
            except Exception as exc:
                LOGGER.warning(
                    "Gemini follow-up generation failed (key=%s): %s",
                    _mask_secret(self.gemini_api_key),
                    exc,
                )
                extra_warnings.append("Gemini follow-up failed; trying next backend.")

        # Tier 2: OpenAI
        if self.api_key:
            try:
                answer = self._generate_openai_messages(messages)
                if answer.strip():
                    self.last_used_model = f"openai:{self.model}"
                    return answer.strip(), extra_warnings
            except Exception as exc:
                LOGGER.warning("OpenAI follow-up generation failed: %s", exc)
                extra_warnings.append("OpenAI failed; trying local Ollama.")

        # Tier 3: Local Ollama
        if self.ollama_enabled:
            try:
                answer = self._generate_ollama_messages(messages)
                if answer.strip():
                    self.last_used_model = f"ollama:{self.ollama_model}"
                    return answer.strip(), extra_warnings
                extra_warnings.append("Ollama returned empty follow-up content; using fallback.")
            except Exception as exc:
                LOGGER.warning("Ollama follow-up generation failed: %s", exc)
                extra_warnings.append("Ollama unavailable; switched to deterministic follow-up response.")

        self.last_used_model = "deterministic-fallback"
        return (
            self._generate_followup_fallback(session_context=session_context, user_message=user_message),
            extra_warnings,
        )
