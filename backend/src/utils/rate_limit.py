"""Lightweight in-memory rate limiter.

Designed for single-process MVP deployment. For multi-process / multi-host
deployments, swap with Redis-backed limiter.
"""
from __future__ import annotations

import os
import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Deque

from fastapi import HTTPException, Request

_BOOL_TRUE = {"1", "true", "yes", "y", "on"}


def _enabled() -> bool:
    raw = os.getenv("RATE_LIMIT_ENABLED", "true").strip().lower()
    return raw in _BOOL_TRUE


def _trusted_proxy_count() -> int:
    """Số hop reverse-proxy TIN CẬY đứng trước app (mặc định 1 — vd gateway HF Space).

    Dùng để biết phần tử nào trong X-Forwarded-For là IP do proxy tin cậy ghi (không
    giả mạo được). Đặt 0 khi không có proxy tin cậy → dùng thẳng IP kết nối trực tiếp.
    """
    try:
        return max(0, int(os.getenv("TRUSTED_PROXY_COUNT", "1")))
    except ValueError:
        return 1


def _client_key(request: Request, scope: str) -> str:
    # Bucket theo IP THẬT của client. KHÔNG tin phần ĐẦU của X-Forwarded-For: client tự
    # đặt được header này → giả IP để né rate limit (brute-force login/forgot-password).
    # Reverse proxy tin cậy NỐI THÊM IP nó nhận vào CUỐI chuỗi, nên IP thật nằm ở vị trí
    # thứ TRUSTED_PROXY_COUNT tính từ cuối; client không chèn được vào sau IP do proxy ghi.
    direct_ip = request.client.host if request.client else "unknown"
    hops = _trusted_proxy_count()
    if hops <= 0:
        return f"{scope}:{direct_ip}"

    forwarded = request.headers.get("x-forwarded-for", "")
    parts = [p.strip() for p in forwarded.split(",") if p.strip()]
    if not parts:
        return f"{scope}:{direct_ip}"

    idx = len(parts) - hops
    if idx < 0:
        idx = 0
    return f"{scope}:{parts[idx]}"


# Chặn rò rỉ bộ nhớ dài hạn: dọn bucket nhàn rỗi khi từ điển phình quá ngưỡng.
_MAX_BUCKETS = 10_000
_IDLE_EVICT_SECONDS = 3600


@dataclass
class _Bucket:
    hits: Deque[float]


class RateLimiter:
    def __init__(self) -> None:
        self._buckets: dict[str, _Bucket] = {}
        self._lock = threading.Lock()

    def _evict_idle(self, now: float) -> None:
        # Xóa bucket không còn hit nào trong ~1 giờ qua (nhàn rỗi) để giải phóng bộ nhớ.
        threshold = now - _IDLE_EVICT_SECONDS
        stale = [k for k, b in self._buckets.items() if not b.hits or b.hits[-1] < threshold]
        for k in stale:
            del self._buckets[k]

    def hit(self, *, key: str, max_hits: int, window_seconds: int) -> bool:
        if not _enabled():
            return True

        now = time.monotonic()
        cutoff = now - window_seconds

        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                if len(self._buckets) >= _MAX_BUCKETS:
                    self._evict_idle(now)
                bucket = _Bucket(hits=deque())
                self._buckets[key] = bucket

            while bucket.hits and bucket.hits[0] < cutoff:
                bucket.hits.popleft()

            if len(bucket.hits) >= max_hits:
                return False

            bucket.hits.append(now)
            return True

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()


_LIMITER = RateLimiter()


def enforce_rate_limit(
    *,
    request: Request,
    scope: str,
    max_hits: int,
    window_seconds: int,
) -> None:
    """Raise HTTP 429 when the caller exceeds the bucket budget."""
    key = _client_key(request, scope)
    if not _LIMITER.hit(key=key, max_hits=max_hits, window_seconds=window_seconds):
        raise HTTPException(
            status_code=429,
            detail=f"Too many {scope} requests. Try again in {window_seconds}s.",
        )


def reset_rate_limiter_for_tests() -> None:
    _LIMITER.reset()
