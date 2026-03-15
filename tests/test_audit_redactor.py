"""Tests for PII redaction pipeline."""

from __future__ import annotations

import pytest

from aegisforge.audit.redactor import PIIRedactor, RedactionType


@pytest.fixture
def redactor() -> PIIRedactor:
    return PIIRedactor(redact_ip=True)


class TestTextRedaction:
    def test_ssn_redacted(self, redactor: PIIRedactor) -> None:
        assert "[REDACTED:SSN]" in redactor.redact_text("SSN is 123-45-6789")

    def test_email_redacted(self, redactor: PIIRedactor) -> None:
        result = redactor.redact_text("Contact jane@company.com for help")
        assert "jane@company.com" not in result
        assert "[REDACTED:EMAIL]" in result

    def test_phone_redacted(self, redactor: PIIRedactor) -> None:
        result = redactor.redact_text("Call (555) 123-4567")
        assert "(555) 123-4567" not in result

    def test_jwt_redacted(self, redactor: PIIRedactor) -> None:
        fake_jwt = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature123"
        result = redactor.redact_text(f"Token: {fake_jwt}")
        assert fake_jwt not in result
        assert "[REDACTED:JWT]" in result

    def test_aws_key_redacted(self, redactor: PIIRedactor) -> None:
        result = redactor.redact_text("key: AKIAIOSFODNN7EXAMPLE")
        assert "AKIAIOSFODNN7EXAMPLE" not in result
        assert "[REDACTED:AWS_KEY]" in result

    def test_ip_redacted_when_enabled(self, redactor: PIIRedactor) -> None:
        result = redactor.redact_text("Source IP: 192.168.1.100")
        assert "192.168.1.100" not in result
        assert "[REDACTED:IP]" in result

    def test_ip_not_redacted_when_disabled(self) -> None:
        r = PIIRedactor(redact_ip=False)
        result = r.redact_text("Source IP: 192.168.1.100")
        assert "192.168.1.100" in result

    def test_empty_text_passthrough(self, redactor: PIIRedactor) -> None:
        assert redactor.redact_text("") == ""

    def test_no_pii_unchanged(self, redactor: PIIRedactor) -> None:
        text = "This is a normal log message about task execution"
        assert redactor.redact_text(text) == text

    def test_password_in_key_value(self, redactor: PIIRedactor) -> None:
        result = redactor.redact_text("password=SuperSecret123")
        assert "SuperSecret123" not in result

    def test_api_key_pattern(self, redactor: PIIRedactor) -> None:
        result = redactor.redact_text("Using sk-abc123def456ghi789jklmnopqrstuvwx")
        assert "sk-abc123def456" not in result


class TestDictRedaction:
    def test_sensitive_keys_fully_redacted(self, redactor: PIIRedactor) -> None:
        data = {"username": "jane", "password": "secret123", "api_key": "key-abc"}
        result = redactor.redact_dict(data)
        assert result["password"] == f"[REDACTED:{RedactionType.PASSWORD.value}]"
        assert result["api_key"] == f"[REDACTED:{RedactionType.PASSWORD.value}]"
        assert result["username"] == "jane"  # Not a sensitive key

    def test_nested_dict_redacted(self, redactor: PIIRedactor) -> None:
        data = {
            "user": {
                "email": "test@example.com",
                "credentials": {"token": "secret"},
            }
        }
        result = redactor.redact_dict(data)
        assert "test@example.com" not in str(result)
        assert result["user"]["credentials"] == f"[REDACTED:{RedactionType.PASSWORD.value}]"

    def test_list_values_redacted(self, redactor: PIIRedactor) -> None:
        data = {"emails": ["a@b.com", "c@d.com"]}
        result = redactor.redact_dict(data)
        assert all("[REDACTED:EMAIL]" in v for v in result["emails"])

    def test_non_string_values_preserved(self, redactor: PIIRedactor) -> None:
        data = {"count": 42, "active": True, "ratio": 3.14}
        result = redactor.redact_dict(data)
        assert result == data

    def test_depth_limit_prevents_infinite_recursion(self, redactor: PIIRedactor) -> None:
        # Create deeply nested dict
        data: dict = {"level": 0}
        current = data
        for i in range(15):
            current["child"] = {"level": i + 1}
            current = current["child"]
        # Should not raise, just stop recursing
        result = redactor.redact_dict(data)
        assert result is not None
