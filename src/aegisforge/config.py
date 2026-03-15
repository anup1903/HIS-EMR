"""Application configuration via environment variables."""

from enum import Enum
from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    """AegisForge configuration. All secrets loaded from env; never hardcoded."""

    model_config = {"env_prefix": "AEGIS_", "case_sensitive": False, "env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    # Core
    env: Environment = Environment.DEVELOPMENT
    log_level: str = "INFO"
    debug: bool = False

    # Database
    database_url: SecretStr = Field(
        default=SecretStr("postgresql+asyncpg://aegis:localdev@localhost:5432/aegisforge"),
        description="Async PostgreSQL connection string",
    )

    # Redis / Celery
    redis_url: SecretStr = Field(
        default=SecretStr("redis://localhost:6379/0"),
        description="Redis connection string for Celery broker and caching",
    )

    # Auth
    okta_domain: str = ""
    okta_client_id: str = ""
    okta_client_secret: SecretStr = SecretStr("")
    azure_ad_tenant_id: str = ""
    azure_ad_client_id: str = ""

    # External services (tokens loaded at runtime from Vault/Secrets Manager)
    github_app_id: str = ""
    github_private_key_path: str = ""
    jira_base_url: str = ""
    slack_bot_token: SecretStr = SecretStr("")
    pagerduty_integration_key: SecretStr = SecretStr("")
    salesforce_instance_url: str = ""
    servicenow_instance_url: str = ""

    # Operational
    task_timeout_seconds: int = 1800  # 30 minutes
    max_task_retries: int = 3
    canary_soak_minutes: int = 15
    audit_retention_days: int = 2555  # ~7 years

    @property
    def is_production(self) -> bool:
        return self.env == Environment.PRODUCTION


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
