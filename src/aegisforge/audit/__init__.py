"""Immutable audit logging — append-only event trail for compliance.

Every action, decision, approval, and API call is recorded with:
- Who (user_id, service_id)
- What (action, resource, diff)
- When (timestamp, duration)
- Why (reason, approval chain)
- Outcome (success/failure, error)
"""

from aegisforge.audit.logger import AuditLogger, get_audit_logger
from aegisforge.audit.models import AuditEvent, AuditAction
from aegisforge.audit.redactor import PIIRedactor, get_redactor

__all__ = [
    "AuditAction",
    "AuditEvent",
    "AuditLogger",
    "PIIRedactor",
    "get_audit_logger",
    "get_redactor",
]
