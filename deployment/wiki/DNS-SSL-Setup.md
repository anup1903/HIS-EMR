# DNS and SSL Setup

## Azure DNS Zone Setup

### Step 1: Create DNS Zone (one-time)

In Azure Portal:
1. Go to **DNS zones** > **+ Create**
2. Resource group: `AegisForge-RG1`
3. Name: `his-emr.com` (or your custom domain)
4. Click **Create**

### Step 2: Register DNS Records

For each environment, create A records pointing subdomains to the VM's public IP:

**DEV Environment** (VM IP: `20.192.170.10`):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | his-emr.dev | 20.192.170.10 | 300 |
| A | aegisforge-api.dev | 20.192.170.10 | 300 |
| A | aegisforge.dev | 20.192.170.10 | 300 |
| A | medbridge.dev | 20.192.170.10 | 300 |
| A | n8n.dev | 20.192.170.10 | 300 |

**TRAINING Environment** (replace with Training VM IP):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | his-emr.training | TRAINING_VM_IP | 300 |
| A | aegisforge-api.training | TRAINING_VM_IP | 300 |
| A | aegisforge.training | TRAINING_VM_IP | 300 |
| A | medbridge.training | TRAINING_VM_IP | 300 |
| A | n8n.training | TRAINING_VM_IP | 300 |

### Step 3: Point Domain Registrar to Azure

Copy the NS records from Azure DNS Zone and update your domain registrar's nameservers.

### Automated Setup

Run on the VM:
```bash
cd /opt/his-emr-platform/deployment
az login
./scripts/setup-dns-ssl.sh dev
```

## SSL Certificates

SSL is managed automatically via Let's Encrypt + Certbot:
- Certificates are stored in the `certbot-conf` Docker volume
- Auto-renewal runs every 12 hours via the certbot container
- Nginx picks up renewed certificates automatically

### Manual Certificate Generation

```bash
docker run --rm -p 80:80 \
  -v certbot-conf:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  --agree-tos --no-eff-email \
  --email admin@his-emr.com \
  -d his-emr.dev.his-emr.com \
  -d aegisforge-api.dev.his-emr.com \
  -d aegisforge.dev.his-emr.com \
  -d medbridge.dev.his-emr.com \
  -d n8n.dev.his-emr.com
```

## NSG (Network Security Group) Rules

Ensure the VM's NSG allows inbound traffic on these ports:

| Priority | Name | Port | Protocol | Source |
|----------|------|------|----------|--------|
| 100 | HTTP | 80 | TCP | Any |
| 110 | HTTPS | 443 | TCP | Any |
| 120 | SSH | 22 | TCP | Your IP |

Block direct access to service ports (9003, 8000, 3001, 3456, 5678) — all traffic should go through Nginx.

## Service URLs

### DEV
- HIS-EMR: `https://his-emr.dev.his-emr.com`
- AegisForge API: `https://aegisforge-api.dev.his-emr.com`
- AegisForge UI: `https://aegisforge.dev.his-emr.com`
- MedBridge: `https://medbridge.dev.his-emr.com`
- n8n: `https://n8n.dev.his-emr.com`

### TRAINING
- HIS-EMR: `https://his-emr.training.his-emr.com`
- AegisForge API: `https://aegisforge-api.training.his-emr.com`
- AegisForge UI: `https://aegisforge.training.his-emr.com`
- MedBridge: `https://medbridge.training.his-emr.com`
- n8n: `https://n8n.training.his-emr.com`
