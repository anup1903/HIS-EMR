"""Healthcare EHR/EMR Connector — FHIR R4, HL7 v2.x, and EDI integration.

Connects AegisForge agent to MedBridge Connect middleware and external
EHR systems (Epic, Oracle Health, Meditech) via FHIR/HL7/EDI protocols.

Supports:
- FHIR R4 resource CRUD (Patient, Encounter, Observation, Coverage, Claim)
- HL7 v2.x message send/parse (ADT, ORM, ORU, DFT)
- EDI 270/271 eligibility, 278 prior-auth, 837 claim submission
- Prior authorization workflow automation
- Discharge orchestration
- MedBridge channel management
"""

from __future__ import annotations

import json
from typing import Any
from urllib.parse import urljoin

import httpx
import structlog

from aegisforge.connectors.base import BaseConnector, ConnectorResult

logger = structlog.get_logger()


class HealthcareConnector(BaseConnector):
    """Connector for healthcare EHR/EMR systems via MedBridge middleware."""

    connector_name = "healthcare"
    _supported_actions = {
        # FHIR R4 operations
        "fhir_read",
        "fhir_search",
        "fhir_create",
        "fhir_update",
        # HL7 v2.x operations
        "hl7_send",
        "hl7_parse",
        # EDI operations
        "edi_eligibility_check",
        "edi_prior_auth_submit",
        "edi_claim_submit",
        "edi_parse",
        # MedBridge middleware operations
        "medbridge_send_message",
        "medbridge_list_channels",
        "medbridge_channel_status",
        "medbridge_get_messages",
        "medbridge_get_stats",
        # Prior-auth workflow
        "prior_auth_initiate",
        "prior_auth_check_status",
        "prior_auth_appeal",
        # Discharge orchestration
        "discharge_initiate",
        "discharge_check_readiness",
        "discharge_schedule_followup",
        # Task routing
        "task_route",
        "task_list_pending",
    }

    def __init__(
        self,
        medbridge_url: str = "http://localhost:3456",
        fhir_base_url: str = "",
        fhir_auth_token: str = "",
        edi_gateway_url: str = "",
        edi_sender_id: str = "",
        edi_receiver_id: str = "",
    ) -> None:
        self._medbridge_url = medbridge_url.rstrip("/")
        self._fhir_base_url = fhir_base_url.rstrip("/") if fhir_base_url else ""
        self._fhir_auth_token = fhir_auth_token
        self._edi_gateway_url = edi_gateway_url
        self._edi_sender_id = edi_sender_id or "AEGISFORGE"
        self._edi_receiver_id = edi_receiver_id or "PAYER001"
        self._client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def _dispatch(self, action: str, params: dict[str, Any]) -> ConnectorResult:
        handler = getattr(self, f"_action_{action}", None)
        if handler is None:
            return ConnectorResult(success=False, error=f"No handler for action: {action}")
        return await handler(params)

    async def health_check(self) -> bool:
        try:
            client = self._get_client()
            resp = await client.get(f"{self._medbridge_url}/api/health")
            return resp.status_code == 200
        except Exception:
            return False

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    # ── FHIR R4 Operations ──────────────────────────────────────────

    async def _action_fhir_read(self, params: dict) -> ConnectorResult:
        """Read a FHIR resource. params: resource_type, resource_id"""
        resource_type = params.get("resource_type", "Patient")
        resource_id = params.get("resource_id", "")
        base = self._fhir_base_url or f"{self._medbridge_url}/api/fhir"

        client = self._get_client()
        headers = {"Accept": "application/fhir+json"}
        if self._fhir_auth_token:
            headers["Authorization"] = f"Bearer {self._fhir_auth_token}"

        url = f"{base}/{resource_type}/{resource_id}" if resource_id else f"{base}/{resource_type}"
        resp = await client.get(url, headers=headers)

        if resp.status_code == 200:
            return ConnectorResult(success=True, data=resp.json())
        return ConnectorResult(success=False, error=f"FHIR read failed: {resp.status_code} {resp.text}")

    async def _action_fhir_search(self, params: dict) -> ConnectorResult:
        """Search FHIR resources. params: resource_type, query (dict of search params)"""
        resource_type = params.get("resource_type", "Patient")
        query = params.get("query", {})
        base = self._fhir_base_url or f"{self._medbridge_url}/api/fhir"

        client = self._get_client()
        headers = {"Accept": "application/fhir+json"}
        if self._fhir_auth_token:
            headers["Authorization"] = f"Bearer {self._fhir_auth_token}"

        resp = await client.get(f"{base}/{resource_type}", params=query, headers=headers)
        if resp.status_code == 200:
            return ConnectorResult(success=True, data=resp.json())
        return ConnectorResult(success=False, error=f"FHIR search failed: {resp.status_code}")

    async def _action_fhir_create(self, params: dict) -> ConnectorResult:
        """Create a FHIR resource. params: resource_type, resource (JSON body)"""
        resource_type = params.get("resource_type", "Patient")
        resource = params.get("resource", {})
        base = self._fhir_base_url or f"{self._medbridge_url}/api/fhir"

        client = self._get_client()
        headers = {"Content-Type": "application/fhir+json", "Accept": "application/fhir+json"}
        if self._fhir_auth_token:
            headers["Authorization"] = f"Bearer {self._fhir_auth_token}"

        resp = await client.post(f"{base}/{resource_type}", json=resource, headers=headers)
        if resp.status_code in (200, 201):
            return ConnectorResult(success=True, data=resp.json())
        return ConnectorResult(success=False, error=f"FHIR create failed: {resp.status_code} {resp.text}")

    async def _action_fhir_update(self, params: dict) -> ConnectorResult:
        """Update a FHIR resource. params: resource_type, resource_id, resource"""
        resource_type = params.get("resource_type", "Patient")
        resource_id = params.get("resource_id", "")
        resource = params.get("resource", {})
        base = self._fhir_base_url or f"{self._medbridge_url}/api/fhir"

        client = self._get_client()
        headers = {"Content-Type": "application/fhir+json"}
        if self._fhir_auth_token:
            headers["Authorization"] = f"Bearer {self._fhir_auth_token}"

        resp = await client.put(f"{base}/{resource_type}/{resource_id}", json=resource, headers=headers)
        if resp.status_code in (200, 201):
            return ConnectorResult(success=True, data=resp.json())
        return ConnectorResult(success=False, error=f"FHIR update failed: {resp.status_code}")

    # ── HL7 v2.x Operations ─────────────────────────────────────────

    async def _action_hl7_send(self, params: dict) -> ConnectorResult:
        """Send HL7 message via MedBridge. params: channel_id, message, content_type"""
        channel_id = params.get("channel_id", "")
        message = params.get("message", "")
        content_type = params.get("content_type", "hl7")

        client = self._get_client()
        resp = await client.post(
            f"{self._medbridge_url}/api/messages/send",
            json={"channelId": channel_id, "message": message, "contentType": content_type},
        )
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data)

    async def _action_hl7_parse(self, params: dict) -> ConnectorResult:
        """Parse an HL7 message. params: message"""
        message = params.get("message", "")
        client = self._get_client()
        resp = await client.post(
            f"{self._medbridge_url}/api/messages/parse",
            json={"message": message, "contentType": "hl7"},
        )
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data.get("data"))

    # ── EDI Operations ───────────────────────────────────────────────

    async def _action_edi_eligibility_check(self, params: dict) -> ConnectorResult:
        """Submit EDI 270 eligibility inquiry. params: patient, payer, service_type"""
        client = self._get_client()
        resp = await client.post(
            f"{self._medbridge_url}/api/ai/edi/eligibility",
            json=params,
        )
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data.get("data"))

    async def _action_edi_prior_auth_submit(self, params: dict) -> ConnectorResult:
        """Submit EDI 278 prior authorization. params: patient, provider, procedure, payer"""
        client = self._get_client()
        resp = await client.post(
            f"{self._medbridge_url}/api/ai/edi/prior-auth",
            json=params,
        )
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data.get("data"))

    async def _action_edi_claim_submit(self, params: dict) -> ConnectorResult:
        """Submit EDI 837 professional claim. params: patient, provider, diagnosis, procedures"""
        client = self._get_client()
        resp = await client.post(
            f"{self._medbridge_url}/api/ai/edi/claim",
            json=params,
        )
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data.get("data"))

    async def _action_edi_parse(self, params: dict) -> ConnectorResult:
        """Parse an EDI transaction. params: raw_edi, transaction_type"""
        client = self._get_client()
        resp = await client.post(
            f"{self._medbridge_url}/api/ai/edi/parse",
            json=params,
        )
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data.get("data"))

    # ── MedBridge Middleware Operations ───────────────────────────────

    async def _action_medbridge_send_message(self, params: dict) -> ConnectorResult:
        """Send a message through MedBridge. params: channel_id, message, content_type"""
        return await self._action_hl7_send(params)

    async def _action_medbridge_list_channels(self, params: dict) -> ConnectorResult:
        """List all MedBridge channels."""
        client = self._get_client()
        resp = await client.get(f"{self._medbridge_url}/api/channels")
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data.get("data"))

    async def _action_medbridge_channel_status(self, params: dict) -> ConnectorResult:
        """Get channel status. params: channel_id"""
        channel_id = params.get("channel_id", "")
        client = self._get_client()
        resp = await client.get(f"{self._medbridge_url}/api/channels/{channel_id}")
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data.get("data"))

    async def _action_medbridge_get_messages(self, params: dict) -> ConnectorResult:
        """Get messages with optional filters. params: channel_id, status, search, page, limit"""
        client = self._get_client()
        resp = await client.get(f"{self._medbridge_url}/api/messages", params=params)
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data)

    async def _action_medbridge_get_stats(self, params: dict) -> ConnectorResult:
        """Get MedBridge dashboard stats."""
        client = self._get_client()
        resp = await client.get(f"{self._medbridge_url}/api/dashboard/stats")
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data.get("data"))

    # ── Prior Authorization Workflow ─────────────────────────────────

    async def _action_prior_auth_initiate(self, params: dict) -> ConnectorResult:
        """Initiate prior-auth workflow. params: patient_id, procedure_code, diagnosis_codes, payer_id, provider_npi"""
        client = self._get_client()
        resp = await client.post(
            f"{self._medbridge_url}/api/ai/prior-auth/initiate",
            json=params,
        )
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data.get("data"))

    async def _action_prior_auth_check_status(self, params: dict) -> ConnectorResult:
        """Check prior-auth status. params: auth_id"""
        auth_id = params.get("auth_id", "")
        client = self._get_client()
        resp = await client.get(f"{self._medbridge_url}/api/ai/prior-auth/{auth_id}")
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data.get("data"))

    async def _action_prior_auth_appeal(self, params: dict) -> ConnectorResult:
        """File a denial appeal. params: auth_id, appeal_reason, supporting_docs"""
        client = self._get_client()
        resp = await client.post(
            f"{self._medbridge_url}/api/ai/prior-auth/appeal",
            json=params,
        )
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data.get("data"))

    # ── Discharge Orchestration ──────────────────────────────────────

    async def _action_discharge_initiate(self, params: dict) -> ConnectorResult:
        """Initiate discharge workflow. params: patient_id, encounter_id, discharge_disposition"""
        client = self._get_client()
        resp = await client.post(
            f"{self._medbridge_url}/api/ai/discharge/initiate",
            json=params,
        )
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data.get("data"))

    async def _action_discharge_check_readiness(self, params: dict) -> ConnectorResult:
        """Check discharge readiness. params: patient_id, encounter_id"""
        client = self._get_client()
        resp = await client.post(
            f"{self._medbridge_url}/api/ai/discharge/readiness",
            json=params,
        )
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data.get("data"))

    async def _action_discharge_schedule_followup(self, params: dict) -> ConnectorResult:
        """Schedule follow-up appointments. params: patient_id, provider_id, appointment_type, preferred_date"""
        client = self._get_client()
        resp = await client.post(
            f"{self._medbridge_url}/api/ai/discharge/schedule-followup",
            json=params,
        )
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data.get("data"))

    # ── Task Router ──────────────────────────────────────────────────

    async def _action_task_route(self, params: dict) -> ConnectorResult:
        """Route a task to the appropriate care team. params: task_type, priority, patient_id, description, assignee_role"""
        client = self._get_client()
        resp = await client.post(
            f"{self._medbridge_url}/api/ai/tasks/route",
            json=params,
        )
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data.get("data"))

    async def _action_task_list_pending(self, params: dict) -> ConnectorResult:
        """List pending tasks. params: assignee_role, priority, status"""
        client = self._get_client()
        resp = await client.get(
            f"{self._medbridge_url}/api/ai/tasks",
            params=params,
        )
        data = resp.json()
        return ConnectorResult(success=data.get("success", False), data=data.get("data"))
