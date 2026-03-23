"""
Napkin Backend — LLM Provider
Unified LLM interface using LangChain. Uses Anthropic (Claude) as the sole provider.
"""

from functools import lru_cache

from langchain_anthropic import ChatAnthropic
from langchain_core.embeddings import Embeddings
from langchain_core.language_models import BaseChatModel
from langchain_huggingface import HuggingFaceEmbeddings

from app.core.config import get_settings


@lru_cache
def get_llm(
    model: str | None = None,
    temperature: float | None = None,
) -> BaseChatModel:
    """Get the configured LLM instance (Anthropic Claude)."""
    settings = get_settings()
    model = model or settings.llm_default_model
    temperature = temperature if temperature is not None else settings.llm_temperature

    return ChatAnthropic(
        model=model,
        temperature=temperature,
        api_key=settings.anthropic_api_key,
        max_tokens=8192,
    )


@lru_cache
def get_fast_llm() -> BaseChatModel:
    """Smaller, faster model for extraction and classification tasks."""
    settings = get_settings()
    return ChatAnthropic(
        model="claude-haiku-4-5-20251001",
        temperature=0.0,
        api_key=settings.anthropic_api_key,
        max_tokens=4096,
    )


@lru_cache
def get_strong_llm() -> BaseChatModel:
    """Strongest model for complex reasoning (spec building, synthesis)."""
    settings = get_settings()
    return ChatAnthropic(
        model="claude-sonnet-4-20250514",
        temperature=0.1,
        api_key=settings.anthropic_api_key,
        max_tokens=16384,
    )


@lru_cache
def get_embeddings() -> Embeddings:
    """Get the embeddings model. Uses local HuggingFace all-MiniLM-L6-v2."""
    settings = get_settings()
    return HuggingFaceEmbeddings(
        model_name=settings.embedding_model,
        model_kwargs={"device": "cpu"},
    )
