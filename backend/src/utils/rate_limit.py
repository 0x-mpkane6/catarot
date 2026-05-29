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


def _client_key(request: Request, scope: str) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "unknown"
    return f"{scope}:{ip}"


@dataclass
class _Bucket:
    hits: Deque[float]


class RateLimiter:
    def __init__(self) -> None:
        self._buckets: dict[str, _Bucket] = {}
        self._lock = threading.Lock()

    def hit(self, *, key: str, max_hits: int, window_seconds: int) -> bool:
        if not _enabled():
            return True

        now = time.monotonic()
        cutoff = now - window_seconds

        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
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
