"""Knowledge ingestion service — feeds the RAG pipeline.

Ingestors:
- CodebaseIngestor: Git repos (local or cloned), file-system code
- DocumentIngestor: Markdown docs, Confluence, wikis
- TicketIngestor: Jira issues, ServiceNow incidents
- RunbookIngestor: Ops runbooks, incident playbooks
"""

from aegisforge.knowledge.ingestor import KnowledgeIngestor, get_knowledge_ingestor

__all__ = ["KnowledgeIngestor", "get_knowledge_ingestor"]
