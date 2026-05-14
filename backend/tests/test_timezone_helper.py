from __future__ import annotations

from src.utils.timezone import get_app_timezone


def test_get_app_timezone_uses_configured_value(monkeypatch) -> None:
    monkeypatch.setenv("APP_TIMEZONE", "UTC")
    timezone_info = get_app_timezone()
    assert timezone_info.key == "UTC"


def test_get_app_timezone_falls_back_when_invalid(monkeypatch) -> None:
    monkeypatch.setenv("APP_TIMEZONE", "Invalid/Timezone")
    timezone_info = get_app_timezone()
    assert timezone_info.key in {"Asia/Ho_Chi_Minh", "UTC"}
