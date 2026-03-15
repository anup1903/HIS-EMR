"""PII redaction pipeline — strips sensitive data before logging/storage.

Redacts:
- Social Security Numbers (SSN)
- Credit card numbers (PCI)
- Email addresses
- Phone numbers
- IP addresses (optionally)
- Custom patterns (PHI identifiers, API keys, JWTs)

All redacted values are replaced with [REDACTED:<type>] tokens.
Original values are NEVER stored in logs or audit events.
"""

from __future__ import annotations

import re
from enum import Enum
from functools import lru_cache
from typing import Any

import structlog

logger = structlog.get_logger()


class RedactionType(str, Enum):
    SSN = "SSN"
    CREDIT_CARD = "CC"
    EMAIL = "EMAIL"
    PHONE = "PHONE"
    IP_ADDRESS = "IP"
    API_KEY = "API_KEY"
    JWT = "JWT"
    AWS_KEY = "AWS_KEY"
    PASSWORD = "PASSWORD"


# Compiled regex patterns for each PII type
_PATTERNS: list[tuple[RedactionType, re.Pattern[str]]] = [
    # SSN: 123-45-6789 or 123456789
    (
        RedactionType.SSN,
        re.compile(r"\b\d{3}-?\d{2}-?\d{4}\b"),
    ),
    # Credit card: 13-19 digit sequences (Luhn-validated separately if needed)
    (
        RedactionType.CREDIT_CARD,
        re.compile(r"\b(?:\d[ -]*?){13,19}\b"),
    ),
    # Email
    (
        RedactionType.EMAIL,
        re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),
    ),
    # Phone: various formats
    (
        RedactionType.PHONE,
        re.compile(r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"),
    ),
    # JWT tokens
    (
        RedactionType.JWT,
        re.compile(r"\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b"),
    ),
    # AWS access keys
    (
        RedactionType.AWS_KEY,
        re.compile(r"\b(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b"),
    ),
    # Generic API keys / tokens (long hex or base64 strings)
    (
        RedactionType.API_KEY,
        re.compile(r"\b(?:sk-|pk-|api[_-]?key[_-]?)[A-Za-z0-9]{20,}\b", re.IGNORECASE),
    ),
    # Password-like fields in key=value pairs
    (
        RedactionType.PASSWORD,
        re.compile(
            r"(?i)(?:password|passwd|pwd|secret|token|api_key|apikey|auth)"
            r"\s*[=:]\s*['\"]?([^\s'\"]+)['\"]?"
        ),
    ),
]


class PIIRedactor:
    """Redacts PII/secrets from text, dicts, and structured data.

    Thread-safe and stateless — safe for concurrent use.
    """

    def __init__(
        self,
        extra_patterns: list[tuple[str, re.Pattern[str]]] | None = None,
        redact_ip: bool = False,
    ) -> None:
        self._patterns = list(_PATTERNS)
        if redact_ip:
            self._patterns.append(
                (
                    RedactionType.IP_ADDRESS,
                    re.compile(
                        r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}"
                        r"(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
                    ),
                )
            )
        if extra_patterns:
            for name, pattern in extra_patterns:
                self._patterns.append((RedactionType(name) if name in RedactionType.__members__ else name, pattern))

    def redact_text(self, text: str) -> str:
        """Redact all PII patterns from a string."""
        if not text:
            return text

        result = text
        for redaction_type, pattern in self._patterns:
            label = redaction_type.value if isinstance(redaction_type, RedactionType) else redaction_type
            result = pattern.sub(f"[REDACTED:{label}]", result)
        return result

    def redact_dict(self, data: dict[str, Any], depth: int = 0) -> dict[str, Any]:
        """Recursively redact PII from a dictionary.

        Handles nested dicts, lists, and string values.
        Max depth of 10 to prevent infinite recursion.
        """
        if depth > 10:
            return data

        redacted: dict[str, Any] = {}
        for key, value in data.items():
            # Keys that always get fully redacted
            lower_key = key.lower()
            if any(
                sensitive in lower_key
                for sensitive in (
                    "password", "secret", "token", "api_key", "apikey",
                    "private_key", "credential", "ssn", "credit_card",
                    "authorization",
                )
            ):
                redacted[key] = f"[REDACTED:{RedactionType.PASSWORD.value}]"
            elif isinstance(value, str):
                redacted[key] = self.redact_text(value)
            elif isinstance(value, dict):
                redacted[key] = self.redact_dict(value, depth + 1)
            elif isinstance(value, list):
                redacted[key] = [
                    self.redact_dict(item, depth + 1)
                    if isinstance(item, dict)
                    else self.redact_text(item)
                    if isinstance(item, str)
                    else item
                    for item in value
                ]
            else:
                redacted[key] = value
        return redacted

    def redact_for_log(self, event_dict: dict[str, Any]) -> dict[str, Any]:
        """Redact an entire structlog event dict — use as a structlog processor."""
        return self.redact_dict(event_dict)


@lru_cache(maxsize=1)
def get_redactor() -> PIIRedactor:
    return PIIRedactor(redact_ip=True)
