"""RAG (Retrieval-Augmented Generation) pipeline.

Components:
- embeddings: Open-source embedding models (BGE-M3, E5-Mistral) via sentence-transformers
- vectorstore: pgvector-backed storage and similarity search
- chunker: Intelligent document chunking (code-aware, semantic boundaries)
- retriever: Hybrid search (vector + keyword) with cross-encoder reranking
- pipeline: End-to-end RAG orchestration (query → retrieve → augment → generate)
"""

from aegisforge.rag.pipeline import RAGPipeline, get_rag_pipeline

__all__ = ["RAGPipeline", "get_rag_pipeline"]
