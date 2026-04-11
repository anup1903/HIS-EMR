# Azure DevOps Pipeline Guide

## Pipeline Overview

The ADO pipeline builds Docker images from GitHub source branches and deploys them to the target Azure VM.

### Pipeline Flow

```
[Manual Trigger] → [Build Images] → [Push to GHCR] → [SSH Deploy to VM]
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| environment | string | dev | Target: dev or training |
| buildHIS | boolean | true | Build HIS-EMR image |
| buildAegis | boolean | true | Build AegisForge images |
| buildMedBridge | boolean | true | Build MedBridge image |

## Setting Up the ADO Pipeline

### Step 1: Create ADO Project

1. Go to `dev.azure.com/sdxcloud`
2. Create project: `HIS-EMR-Platform`
3. Initialize the repo with the deployment files

### Step 2: Import Pipeline

1. Go to **Pipelines** > **New Pipeline**
2. Select **Azure Repos Git**
3. Select the repo
4. Choose **Existing Azure Pipelines YAML file**
5. Path: `/deployment/pipelines/azure-pipelines-build.yml`

### Step 3: Create Service Connections

**SSH Connection (for VM deployment):**
1. Go to **Project Settings** > **Service connections**
2. **New service connection** > **SSH**
3. Name: `AegisForge-VM-dev`
4. Host: VM public IP (20.192.170.10)
5. Port: 22
6. Username: your VM admin username
7. Authentication: SSH key (recommended) or password

Repeat for training: `AegisForge-VM-training`

### Step 4: Create Environments

1. Go to **Pipelines** > **Environments**
2. Create: `HIS-EMR-dev`
3. Create: `HIS-EMR-training`
4. Add approval gates as needed

### Step 5: Create Variable Groups

1. Go to **Pipelines** > **Library**
2. Create variable group: `HIS-EMR-Secrets`
3. Add these variables (mark sensitive ones as secret):

| Variable | Type | Description |
|----------|------|-------------|
| GHCR_TOKEN | Secret | GitHub PAT with packages:write |
| GITHUB_PAT | Secret | GitHub PAT with repo access |

### Step 6: Link Variable Group to Pipeline

In the pipeline YAML, add under variables:
```yaml
variables:
- group: HIS-EMR-Secrets
```

## Running the Pipeline

1. Go to **Pipelines** > Select the pipeline
2. Click **Run pipeline**
3. Select environment (dev/training)
4. Choose which services to build
5. Click **Run**

## Monitoring

- Pipeline logs: ADO > Pipelines > Runs
- VM service health: SSH into VM, run `docker compose ps`
- Service logs: `docker compose -f docker-compose.prod.yml logs -f [service-name]`

## Wiki Setup

1. Go to **Project** > **Wiki**
2. Click **Publish code as wiki**
3. Repository: select the ADO repo
4. Folder: `/deployment/wiki`
5. Branch: `main`
6. Wiki name: `HIS-EMR Platform Wiki`
