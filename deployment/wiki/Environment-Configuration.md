# Environment Configuration

## Environment Files

| File | Environment | Used By |
|------|-------------|---------|
| .env.dev | Development | AegisForge-VM1 |
| .env.training | Training/Demo | Training VM |

## Variable Reference

### Container Registry

| Variable | Description | Example |
|----------|-------------|---------|
| REGISTRY | Container registry URL | ghcr.io/anup1903 |
| HIS_TAG | HIS-EMR image tag | dev, training, latest |
| AEGIS_TAG | AegisForge image tag | dev, training, latest |
| MEDBRIDGE_TAG | MedBridge image tag | dev, training, latest |

### PostgreSQL

| Variable | Description | Default |
|----------|-------------|---------|
| POSTGRES_USER | Database admin user | admin |
| POSTGRES_PASSWORD | Database password | **REQUIRED** |

### HIS-EMR

| Variable | Description |
|----------|-------------|
| NEXTAUTH_SECRET | Auth secret (min 32 chars) |
| NEXTAUTH_URL | Public URL of HIS-EMR |

### AegisForge

| Variable | Description |
|----------|-------------|
| TOGETHER_API_KEY | Together AI API key |
| GROQ_API_KEY | Groq API key |

### n8n

| Variable | Description | Default |
|----------|-------------|---------|
| N8N_BASIC_AUTH_USER | n8n admin username | admin |
| N8N_BASIC_AUTH_PASSWORD | n8n admin password | **REQUIRED** |
| N8N_WEBHOOK_URL | Public webhook URL | |

### DNS/SSL

| Variable | Description | Example |
|----------|-------------|---------|
| DOMAIN | Base domain for services | dev.his-emr.com |

## ADO Variable Groups

Store sensitive values in Azure DevOps Library variable groups:

1. Go to ADO > Pipelines > Library
2. Create variable group: `HIS-EMR-Dev-Secrets`
3. Add variables (mark as secret):
   - POSTGRES_PASSWORD
   - NEXTAUTH_SECRET
   - TOGETHER_API_KEY
   - GROQ_API_KEY
   - N8N_BASIC_AUTH_PASSWORD
   - GHCR_TOKEN
   - GITHUB_PAT

4. Repeat for `HIS-EMR-Training-Secrets`

## Port Mapping

| Service | Container Port | Host Port | DNS Subdomain |
|---------|---------------|-----------|---------------|
| HIS-EMR | 3000 | 9003 | his-emr |
| AegisForge API | 8000 | 8000 | aegisforge-api |
| AegisForge UI | 80 | 3001 | aegisforge |
| MedBridge | 3000 | 3456 | medbridge |
| n8n | 5678 | 5678 | n8n |
| PostgreSQL | 5432 | 5432 | (internal) |
| Redis | 6379 | (internal) | (internal) |
| Nginx | 80/443 | 80/443 | (gateway) |
