# Troubleshooting

## Common Issues

### Service won't start

```bash
# Check logs for specific service
docker compose -f docker-compose.prod.yml --env-file .env.dev logs his-app
docker compose -f docker-compose.prod.yml --env-file .env.dev logs aegisforge-api
```

### Database connection errors

```bash
# Verify PostgreSQL is healthy
docker exec his-postgres pg_isready -U admin

# Check if databases exist
docker exec his-postgres psql -U admin -l

# View connection count
docker exec his-postgres psql -U admin -c "SELECT count(*) FROM pg_stat_activity;"
```

### HIS-EMR migration fails

```bash
# Run migration manually
docker compose -f docker-compose.prod.yml --env-file .env.dev run --rm his-migrate

# Check Prisma schema
docker exec his-app npx prisma db push --skip-generate
```

### Redis connection errors (AegisForge)

```bash
docker exec his-redis redis-cli ping
# Should return: PONG
```

### Port conflicts

```bash
# Check what's using a port
sudo lsof -i :9003
sudo lsof -i :8000
```

### Docker disk space

```bash
# Check disk usage
docker system df

# Clean up old images
docker image prune -a --filter "until=24h"
docker volume prune
```

### SSL certificate issues

```bash
# Check certificate status
docker exec his-certbot certbot certificates

# Force renewal
docker exec his-certbot certbot renew --force-renewal
docker compose restart nginx
```

### Nginx returns 502

Service is down or not yet ready. Check:
```bash
docker compose ps  # All services should be "Up" or "healthy"
docker compose logs nginx
```

## Health Check URLs

| Service | Health URL |
|---------|-----------|
| HIS-EMR | http://localhost:9003 |
| AegisForge API | http://localhost:8000/healthz |
| MedBridge | http://localhost:3456/api/health |

## Restart All Services

```bash
cd /opt/his-emr-platform/deployment
docker compose -f docker-compose.prod.yml --env-file .env.dev down
docker compose -f docker-compose.prod.yml --env-file .env.dev up -d
```

## Full Reset (destroys data)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.dev down -v
# This deletes ALL volumes including databases!
docker compose -f docker-compose.prod.yml --env-file .env.dev up -d
```
