# HIS-EMR Platform — Deployment Wiki

## Platform Overview

The HIS-EMR Platform is a healthcare IT system comprising 4 integrated services deployed via Docker Compose on Azure VMs.

### Services

| Service | Technology | Internal Port | Description |
|---------|-----------|---------------|-------------|
| HIS-EMR | Next.js 16, Prisma, PostgreSQL | 3000 | Hospital Information System |
| AegisForge API | Python, FastAPI, Celery, Redis | 8000 | AI Agent Platform |
| AegisForge Frontend | React/Vite, Nginx | 80 | AegisForge Web UI |
| MedBridge Connect | Node.js, Express, SQLite | 3000 | EMR/EHR Middleware |
| n8n | n8n (Docker Hub) | 5678 | Workflow Automation |

### Infrastructure

| Component | Image | Purpose |
|-----------|-------|---------|
| PostgreSQL | pgvector/pgvector:pg16 | Shared database (3 DBs: his_system, aegisforge, n8n) |
| Redis | redis:7-alpine | Task queue for AegisForge Celery workers |
| Nginx | nginx:1.27-alpine | Reverse proxy, SSL termination |
| Certbot | certbot/certbot | Automatic SSL certificate renewal |

### Environments

| Environment | Domain | Purpose |
|-------------|--------|---------|
| DEV | dev.his-emr.com | Development and testing |
| TRAINING | training.his-emr.com | Training and demos |

### Source Code

All services are in a single GitHub repository with separate branches:

| Service | Branch | GitHub |
|---------|--------|--------|
| HIS-EMR | feat/initial-setup | github.com/anup1903/HIS-EMR |
| AegisForge | aegisforge-healthcare | github.com/anup1903/HIS-EMR |
| MedBridge Connect | EMR-EHR | github.com/anup1903/HIS-EMR |

### Wiki Pages

- [Architecture](./Architecture.md)
- [Deployment Guide](./Deployment-Guide.md)
- [Environment Configuration](./Environment-Configuration.md)
- [DNS and SSL Setup](./DNS-SSL-Setup.md)
- [Troubleshooting](./Troubleshooting.md)
- [ADO Pipeline Guide](./ADO-Pipeline-Guide.md)
