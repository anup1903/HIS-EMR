"""Tests for application configuration."""

from __future__ import annotations

from aegisforge.config import Environment, Settings


def test_default_settings() -> None:
    settings = Settings()
    assert settings.env == Environment.DEVELOPMENT
    assert settings.is_production is False
    assert settings.task_timeout_seconds == 1800
    assert settings.max_task_retries == 3


def test_production_detection() -> None:
    settings = Settings(env=Environment.PRODUCTION)
    assert settings.is_production is True


def test_secrets_are_secret_str() -> None:
    settings = Settings()
    # SecretStr should not expose values in repr/str
    assert "localdev" not in repr(settings.database_url)
    # But get_secret_value should work
    assert "localdev" in settings.database_url.get_secret_value()
