#!/bin/bash
set -euo pipefail

# ===========================================
# DNS Registration + SSL Setup Script
# ===========================================
# Run this ONCE on the VM after initial deployment
# Prerequisites: Azure CLI installed, DNS zone exists
# Usage: ./setup-dns-ssl.sh [dev|training]

ENVIRONMENT="${1:-dev}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment
ENV_FILE="${DEPLOY_DIR}/.env.${ENVIRONMENT}"
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found"
    exit 1
fi
export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)

# Get VM public IP
VM_IP=$(curl -s ifconfig.me)
echo "VM Public IP: $VM_IP"
echo "Domain: $DOMAIN"

# ============================================================
# Step 1: Register DNS records in Azure DNS
# ============================================================
echo ""
echo "[1/3] Registering DNS records..."

# Azure resource group containing your DNS zone
DNS_RG="${DNS_RESOURCE_GROUP:-AegisForge-RG1}"
DNS_ZONE="${DOMAIN}"

SUBDOMAINS=("his-emr" "aegisforge-api" "aegisforge" "medbridge" "n8n")

for sub in "${SUBDOMAINS[@]}"; do
    echo "  Creating A record: ${sub}.${DOMAIN} -> ${VM_IP}"
    az network dns record-set a add-record \
        --resource-group "$DNS_RG" \
        --zone-name "$DNS_ZONE" \
        --record-set-name "$sub" \
        --ipv4-address "$VM_IP" \
        --ttl 300 2>/dev/null || echo "  (record may already exist)"
done

echo "  DNS records registered."

# ============================================================
# Step 2: Generate SSL certificates with Certbot
# ============================================================
echo ""
echo "[2/3] Generating SSL certificates with Let's Encrypt..."

CERT_DOMAINS=""
for sub in "${SUBDOMAINS[@]}"; do
    CERT_DOMAINS="$CERT_DOMAINS -d ${sub}.${DOMAIN}"
done

docker run --rm \
    -v "$(docker volume inspect his-emr-platform_certbot-conf --format '{{ .Mountpoint }}')":/etc/letsencrypt \
    -v "$(docker volume inspect his-emr-platform_certbot-www --format '{{ .Mountpoint }}')":/var/www/certbot \
    certbot/certbot certonly \
    --standalone \
    --agree-tos \
    --no-eff-email \
    --email "${CERTBOT_EMAIL:-admin@${DOMAIN}}" \
    $CERT_DOMAINS

echo "  SSL certificates generated."

# ============================================================
# Step 3: Restart Nginx with SSL
# ============================================================
echo ""
echo "[3/3] Restarting Nginx..."
docker compose -f "${DEPLOY_DIR}/docker-compose.prod.yml" --env-file "$ENV_FILE" restart nginx

echo ""
echo "============================================"
echo "  DNS + SSL Setup Complete!"
echo "============================================"
echo ""
echo "Service URLs:"
for sub in "${SUBDOMAINS[@]}"; do
    echo "  https://${sub}.${DOMAIN}"
done
echo ""
echo "Note: DNS propagation may take 5-10 minutes."
