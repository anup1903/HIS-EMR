# Architecture

## System Architecture

```
                        Internet
                           |
                     [Azure DNS]
                           |
                    [Nginx :80/:443]
                     Reverse Proxy
                    /    |    |    \      \
                   /     |    |     \      \
           [HIS-EMR] [Aegis [Aegis  [Med-  [n8n]
            :3000    API]   UI]    Bridge]  :5678
                     :8000  :80    :3000
                       |
                  [Aegis Worker]
                   (Celery)
                       |
              +--------+--------+
              |                 |
         [PostgreSQL]       [Redis]
          :5432              :6379
          - his_system
          - aegisforge
          - n8n
```

## Service Communication

| From | To | Protocol | Purpose |
|------|----|----------|---------|
| MedBridge | HIS-EMR | HTTP | Patient data, HL7/FHIR |
| MedBridge | AegisForge API | HTTP | AI agent tasks |
| MedBridge | n8n | HTTP | Workflow triggers |
| AegisForge API | Redis | TCP | Task queue |
| AegisForge Worker | Redis | TCP | Task consumption |
| AegisForge API | PostgreSQL | TCP | Data persistence |
| HIS-EMR | PostgreSQL | TCP | Patient records |
| n8n | PostgreSQL | TCP | Workflow state |
| Nginx | All services | HTTP | Reverse proxy |

## Docker Network

All services run on a single `his-network` bridge network. Services communicate using container names as hostnames (e.g., `http://his-app:3000`).

## Data Persistence

| Volume | Service | Data |
|--------|---------|------|
| pgdata | PostgreSQL | All databases |
| redis-data | Redis | Task queue cache |
| medbridge-data | MedBridge | SQLite data |
| n8n-data | n8n | Workflows, credentials |
| certbot-conf | Certbot | SSL certificates |
