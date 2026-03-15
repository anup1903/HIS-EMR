"""LLM+RAG powered goal decomposition — the brain of AegisForge.

Takes a high-level Goal, retrieves relevant codebase/doc context via RAG,
and uses a reasoning-tier LLM (DeepSeek-R1) to produce an executable Plan.
"""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from aegisforge.llm.client import LLMClient, get_llm_client
from aegisforge.llm.models import LLMRequest, Message, ModelTier
from aegisforge.planner.models import (
    Goal,
    Plan,
    RiskLevel,
    TaskNode,
    TaskStatus,
    TaskType,
)
from aegisforge.rag.pipeline import RAGPipeline

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from aegisforge.memory.episodic import EpisodicMemory
    from aegisforge.memory.rules import RuleEngine

logger = structlog.get_logger()

DECOMPOSITION_SYSTEM_PROMPT = """\
You are AegisForge, an enterprise autonomy agent that decomposes goals into \
executable task plans.

You MUST output valid JSON matching this schema:
{
  "reasoning": "Your step-by-step thinking about how to achieve this goal",
  "assumptions": ["assumption1", "assumption2"],
  "open_questions": ["question1"],
  "tasks": [
    {
      "name": "short task name",
      "description": "detailed description of what to do",
      "task_type": "code_generation|code_modification|code_review|test_creation|\
test_execution|ci_cd_trigger|db_migration|api_call|infrastructure|\
documentation|approval_gate|analysis|notification",
      "depends_on_indices": [0, 1],  // indices of tasks this depends on (0-based)
      "tool": "github|jira|slack|pagerduty|salesforce|servicenow|shell|db|k8s",
      "tool_input": {},
      "success_criteria": "how to verify this task succeeded",
      "risk_level": "low|medium|high|critical",
      "requires_approval": false,
      "is_destructive": false,
      "rollback_action": "how to undo this if it fails (null if N/A)"
    }
  ]
}

Rules:
- Break complex goals into small, independently executable tasks
- Each task should be completable in under 30 minutes
- Order tasks by dependency — use depends_on_indices to form a valid DAG
- Mark destructive tasks (prod writes, schema changes, deletions) with requires_approval: true
- Always include test tasks after code changes
- Always include a notification task at the end
- Use the retrieved codebase/doc context to make tasks specific and grounded
- If context is insufficient, note what's missing in open_questions
"""


class PlanDecomposer:
    """Decomposes Goals into executable Plans using LLM + RAG.

    Flow:
        Goal → RAG retrieve context → LLM reason → Parse → Validate → Plan
    """

    def __init__(
        self,
        session: AsyncSession,
        llm_client: LLMClient | None = None,
        rag_pipeline: RAGPipeline | None = None,
        episodic_memory: EpisodicMemory | None = None,
        rule_engine: RuleEngine | None = None,
    ) -> None:
        self._session = session
        self._llm = llm_client or get_llm_client()
        self._rag = rag_pipeline
        self._episodic = episodic_memory
        self._rules = rule_engine

    async def decompose(
        self,
        goal: Goal,
        collection: str = "default",
    ) -> Plan:
        """Decompose a goal into an executable plan.

        1. Retrieve relevant context from RAG
        2. Use reasoning-tier LLM to produce a task DAG
        3. Parse and validate the plan
        4. Return a Plan ready for execution or approval
        """
        logger.info(
            "planner.decompose.start",
            goal_id=str(goal.goal_id),
            title=goal.title,
        )

        # 1. Retrieve context via RAG
        rag_context = ""
        rag_sources: list[dict[str, Any]] = []

        if self._rag:
            # Build a retrieval query from the goal
            retrieval_query = f"{goal.title}\n{goal.description}"
            if goal.context:
                retrieval_query += f"\n{goal.context}"

            chunks = await self._rag.retrieve(
                query=retrieval_query,
                collection=collection,
                top_k=12,
            )

            if chunks:
                context_parts = []
                for i, chunk in enumerate(chunks):
                    src = chunk.get("source", "unknown")
                    lines = ""
                    if chunk.get("start_line"):
                        lines = f":{chunk['start_line']}-{chunk.get('end_line', '')}"
                    context_parts.append(f"[{src}{lines}]\n{chunk['content']}")
                    rag_sources.append({
                        "source": src,
                        "score": chunk.get("rerank_score", chunk.get("score", 0)),
                    })

                rag_context = "\n\n---\n\n".join(context_parts)

        # 1b. Retrieve memory context
        memory_context = ""
        rules_context = ""

        if self._episodic:
            try:
                past = await self._episodic.recall(
                    f"{goal.title} {goal.description}", limit=5
                )
                if past:
                    memory_parts = []
                    for p in past:
                        status_emoji = "\u2713" if p.status == "completed" else "\u2717"
                        line = f"{status_emoji} {p.task_name} ({p.task_type}): {p.approach_summary}"
                        if p.lessons_learned:
                            line += f" | Lesson: {p.lessons_learned}"
                        memory_parts.append(line)
                    memory_context = "\n".join(memory_parts)
            except Exception:
                logger.warning("planner.memory_recall_failed", exc_info=True)

        if self._rules:
            try:
                rules = await self._rules.get_relevant_rules(
                    goal.description, limit=8
                )
                if rules:
                    rules_parts = []
                    for r in rules:
                        rules_parts.append(
                            f"[{r['rule_type']}] {r['description']} "
                            f"(confidence: {r['confidence']:.0%})"
                        )
                    rules_context = "\n".join(rules_parts)
            except Exception:
                logger.warning("planner.rules_fetch_failed", exc_info=True)

        # 2. Build the prompt
        user_prompt_parts = [
            f"## Goal\n**{goal.title}**\n\n{goal.description}",
        ]
        if goal.context:
            user_prompt_parts.append(f"\n## Additional Context\n{goal.context}")
        if goal.constraints:
            user_prompt_parts.append(
                "\n## Constraints\n" + "\n".join(f"- {c}" for c in goal.constraints)
            )
        if goal.acceptance_criteria:
            user_prompt_parts.append(
                "\n## Acceptance Criteria\n"
                + "\n".join(f"- {c}" for c in goal.acceptance_criteria)
            )

        if memory_context:
            user_prompt_parts.append(
                f"\n## Past Experience\n{memory_context}"
            )
        if rules_context:
            user_prompt_parts.append(
                f"\n## Learned Rules\n{rules_context}"
            )

        user_prompt = "\n".join(user_prompt_parts)
        user_prompt += "\n\nDecompose this goal into an executable task plan. Output JSON only."

        # 3. Call reasoning-tier LLM (DeepSeek-R1)
        request = LLMRequest(
            tier=ModelTier.REASONING,
            system_prompt=DECOMPOSITION_SYSTEM_PROMPT,
            messages=[Message(role="user", content=user_prompt)],
            rag_context=rag_context if rag_context else None,
            rag_sources=rag_sources,
            temperature=0.0,
            max_tokens=16384,
            enable_thinking=True,
        )

        response = await self._llm.complete(request)

        # 4. Parse the JSON response
        plan = self._parse_plan(response.content, goal, rag_sources)

        # Attach LLM reasoning (from DeepSeek-R1 chain-of-thought)
        if response.thinking:
            plan.reasoning = response.thinking

        # 5. Validate the DAG
        errors = plan.validate_dag()
        if errors:
            logger.warning(
                "planner.decompose.dag_errors",
                goal_id=str(goal.goal_id),
                errors=errors,
            )
            for error in errors:
                plan.open_questions.append(f"DAG validation issue: {error}")

        logger.info(
            "planner.decompose.complete",
            goal_id=str(goal.goal_id),
            tasks=plan.task_count,
            rag_sources=len(rag_sources),
            model=response.model,
            tokens=response.usage.total_tokens,
        )

        return plan

    def _parse_plan(
        self,
        llm_output: str,
        goal: Goal,
        rag_sources: list[dict[str, Any]],
    ) -> Plan:
        """Parse LLM JSON output into a Plan with validated TaskNodes."""
        # Extract JSON from the response (handle markdown code blocks)
        json_str = llm_output.strip()
        if "```json" in json_str:
            json_str = json_str.split("```json")[1].split("```")[0].strip()
        elif "```" in json_str:
            json_str = json_str.split("```")[1].split("```")[0].strip()

        try:
            data = json.loads(json_str)
        except json.JSONDecodeError as exc:
            logger.error("planner.parse_failed", error=str(exc), output=llm_output[:500])
            # Return a minimal plan with the parsing error
            return Plan(
                goal=goal,
                reasoning=llm_output,
                open_questions=[f"Failed to parse LLM output as JSON: {exc}"],
                rag_sources_used=rag_sources,
            )

        # Build task nodes
        task_nodes: list[TaskNode] = []
        raw_tasks = data.get("tasks", [])

        for raw in raw_tasks:
            # Map task_type string to enum
            try:
                task_type = TaskType(raw.get("task_type", "analysis"))
            except ValueError:
                task_type = TaskType.ANALYSIS

            try:
                risk = RiskLevel(raw.get("risk_level", "low"))
            except ValueError:
                risk = RiskLevel.LOW

            node = TaskNode(
                name=raw.get("name", "Unnamed task"),
                description=raw.get("description", ""),
                task_type=task_type,
                tool=raw.get("tool"),
                tool_input=raw.get("tool_input", {}),
                success_criteria=raw.get("success_criteria", ""),
                risk_level=risk,
                requires_approval=raw.get("requires_approval", False),
                is_destructive=raw.get("is_destructive", False),
                rollback_action=raw.get("rollback_action"),
            )
            task_nodes.append(node)

        # Resolve depends_on_indices → actual task UUIDs
        for i, raw in enumerate(raw_tasks):
            dep_indices = raw.get("depends_on_indices", [])
            for idx in dep_indices:
                if 0 <= idx < len(task_nodes) and idx != i:
                    task_nodes[i].depends_on.append(task_nodes[idx].task_id)

        # Auto-flag destructive tasks that need approval
        for node in task_nodes:
            if node.risk_level in (RiskLevel.HIGH, RiskLevel.CRITICAL):
                node.requires_approval = True
            if node.task_type in (TaskType.DB_MIGRATION, TaskType.INFRASTRUCTURE):
                node.requires_approval = True

        return Plan(
            goal=goal,
            tasks=task_nodes,
            reasoning=data.get("reasoning", ""),
            assumptions=data.get("assumptions", []),
            open_questions=data.get("open_questions", []),
            rag_sources_used=rag_sources,
        )

    async def refine_plan(
        self,
        plan: Plan,
        feedback: str,
        collection: str = "default",
    ) -> Plan:
        """Refine an existing plan based on human feedback.

        Used when an approver requests changes before approving the plan.
        """
        logger.info(
            "planner.refine.start",
            plan_id=str(plan.plan_id),
            feedback=feedback[:100],
        )

        # Serialize current plan for the LLM
        current_plan_json = json.dumps(
            {
                "reasoning": plan.reasoning,
                "assumptions": plan.assumptions,
                "tasks": [
                    {
                        "name": t.name,
                        "description": t.description,
                        "task_type": t.task_type.value,
                        "risk_level": t.risk_level.value,
                        "requires_approval": t.requires_approval,
                    }
                    for t in plan.tasks
                ],
            },
            indent=2,
        )

        messages = [
            Message(role="user", content=f"Here is the current plan:\n```json\n{current_plan_json}\n```"),
            Message(role="assistant", content="I've reviewed the current plan. What changes would you like?"),
            Message(role="user", content=f"Please refine the plan based on this feedback:\n{feedback}\n\nOutput the complete revised plan as JSON."),
        ]

        request = LLMRequest(
            tier=ModelTier.REASONING,
            system_prompt=DECOMPOSITION_SYSTEM_PROMPT,
            messages=messages,
            temperature=0.0,
            max_tokens=16384,
            enable_thinking=True,
        )

        response = await self._llm.complete(request)
        refined = self._parse_plan(response.content, plan.goal, plan.rag_sources_used)

        if response.thinking:
            refined.reasoning = response.thinking

        logger.info(
            "planner.refine.complete",
            plan_id=str(plan.plan_id),
            original_tasks=plan.task_count,
            refined_tasks=refined.task_count,
        )

        return refined
