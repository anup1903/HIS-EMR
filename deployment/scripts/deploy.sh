#!/bin/bash
set -euo pipefail

# ===========================================
# HIS-EMR Platform — VM Deployment Script
# ===========================================
# Usage: ./deploy.sh [dev|training]

ENVIRONMENT="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo "  HIS-EMR Platform Deployment"
echo "  Environment: ${ENVIRONMENT}"
echo "  Time: $(date)"
echo "============================================"

# Validate environment
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "training" ]]; then
    echo "ERROR: Invalid environment. Use 'dev' or 'training'"
    exit 1
fi

ENV_FILE="${DEPLOY_DIR}/.env.${ENVIRONMENT}"
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: Environment file not found: $ENV_FILE"
    echo "Copy .env.template to .env.${ENVIRONMENT} and fill in the values"
    exit 1
fi

# Load environment
export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)

echo ""
echo "[1/4] Logging into container registry..."
echo "${GHCR_TOKEN}" | docker login ghcr.io -u anup1903 --password-stdin

echo ""
echo "[2/4] Pulling latest images..."
docker compose -f "${DEPLOY_DIR}/docker-compose.prod.yml" --env-file "$ENV_FILE" pull

echo ""
echo "[3/4] Stopping old containers..."
docker compose -f "${DEPLOY_DIR}/docker-compose.prod.yml" --env-file "$ENV_FILE" down --remove-orphans

echo ""
echo "[4/4] Starting services..."
docker compose -f "${DEPLOY_DIR}/docker-compose.prod.yml" --env-file "$ENV_FILE" up -d

echo ""
echo "============================================"
echo "  Deployment complete!"
echo "  Waiting for health checks..."
echo "============================================"
sleep 10

docker compose -f "${DEPLOY_DIR}/docker-compose.prod.yml" --env-file "$ENV_FILE" ps

echo ""
echo "Service URLs:"
echo "  HIS-EMR:           http://$(hostname -I | awk '{print $1}'):9003"
echo "  AegisForge API:    http://$(hostname -I | awk '{print $1}'):8000"
echo "  AegisForge UI:     http://$(hostname -I | awk '{print $1}'):3001"
echo "  MedBridge Connect: http://$(hostname -I | awk '{print $1}'):3456"
echo "  n8n:               http://$(hostname -I | awk '{print $1}'):5678"
