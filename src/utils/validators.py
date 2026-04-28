"""Shared validators used across auth/community/etc."""
from __future__ import annotations

import re

EMAIL_REGEX = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


def is_valid_email(email: str | None) -> bool:
    if not email:
        return False
    candidate = email.strip()
    if len(candidate) > 254:
        return False
    return bool(EMAIL_REGEX.match(candidate))


def normalize_email(email: str | None) -> str:
    return (email or "").strip().lower()
