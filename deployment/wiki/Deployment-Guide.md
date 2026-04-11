# Deployment Guide

## Prerequisites

### On your Azure VM (AegisForge-VM1):

1. Docker Engine 24+
2. Docker Compose v2
3. Azure CLI
4. Git

### Install Docker on Ubuntu VM:
```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
# Log out and back in for group changes
```

## Initial Setup (One-time)

### Step 1: Clone the deployment repo on the VM

```bash
sudo mkdir -p /opt/his-emr-platform
sudo chown $USER:$USER /opt/his-emr-platform
cd /opt/his-emr-platform
git clone https://github.com/anup1903/HIS-EMR.git .
git checkout main
```

### Step 2: Configure environment

```bash
cd deployment
cp .env.template .env.dev    # or .env.training
# Edit with your actual values:
nano .env.dev
```

**Required values to change:**
- `POSTGRES_PASSWORD` — strong database password
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `TOGETHER_API_KEY` — your Together AI key
- `GROQ_API_KEY` — your Groq API key
- `N8N_BASIC_AUTH_PASSWORD` — strong n8n admin password
- `DOMAIN` — your registered domain

### Step 3: First deployment

```bash
chmod +x scripts/deploy.sh
GHCR_TOKEN=your_github_pat ./scripts/deploy.sh dev
```

### Step 4: Set up DNS and SSL (optional)

```bash
chmod +x scripts/setup-dns-ssl.sh
az login
./scripts/setup-dns-ssl.sh dev
```

## Updating Services

To deploy new code changes:

1. Push code to the appropriate GitHub branch
2. Run the ADO pipeline (Build + Deploy)
3. Or SSH into VM and run: `./scripts/deploy.sh dev`

## Checking Status

```bash
cd /opt/his-emr-platform/deployment
docker compose -f docker-compose.prod.yml --env-file .env.dev ps
docker compose -f docker-compose.prod.yml --env-file .env.dev logs -f --tail 50
```

## Stopping Services

```bash
docker compose -f docker-compose.prod.yml --env-file .env.dev down
```

## Backup Database

```bash
docker exec his-postgres pg_dumpall -U admin > backup_$(date +%Y%m%d).sql
```
