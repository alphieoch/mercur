# OpenStore Azure Infrastructure Setup — Startup Tier

## What Was Built

This setup deploys the OpenStore multi-vendor marketplace to Microsoft Azure with a **cost-optimized startup architecture** that scales to near-zero when idle.

**Monthly cost: ~$15–25 (dev) | ~$50–80 (production)**

### Architecture

```
Azure Container Apps (Built-in Ingress + Custom Domain)
    │
    ├── Storefront (Next.js) → ACA — scales to 0 when idle
    ├── Admin Dashboard (Vite/React) → ACA — scales to 0 when idle
    ├── Vendor Portal (Vite/React) → ACA — scales to 0 when idle
    ├── API (Medusa v2) → ACA — scales to 0 when idle
    └── Meilisearch → ACA — 1 replica (search stays warm)
            │
    ┌───────┼───────┐
    ▼       ▼       ▼
┌────────┐ ┌─────┐ ┌──────────────┐
│Azure SQL│ │Azure│ │Azure Blob    │
│Basic/S0 │ │Redis│ │Storage LRS   │
│(~$15)  │ │C0   │ │(~$5)         │
└────────┘ └─────┘ └──────────────┘
    │
    └── PostgreSQL JSONB handles flexible product catalogs
```

### Why Not the Enterprise Stack?

The "eBay-scale" architecture (Hyperscale SQL, Cosmos DB, AI Search, Service Bus, Front Door) costs **~$4,250/month**. For a marketplace with fewer than 100 users, that's burning money.

This startup tier uses **PostgreSQL JSONB** instead of Cosmos DB, **Meilisearch** instead of AI Search, and **ACA built-in ingress** instead of Front Door — cutting costs by **95%** while keeping full production readiness.

### Files Created

#### Infrastructure (Bicep)
| File | Description |
|------|-------------|
| `infra/main.bicep` | Root orchestrator |
| `infra/modules/keyVault.bicep` | Secrets management |
| `infra/modules/containerRegistry.bicep` | Basic ACR for container images |
| `infra/modules/containerAppsEnvironment.bicep` | Shared ACA runtime |
| `infra/modules/containerApps.bicep` | API, Storefront, Admin, Vendor + Meilisearch |
| `infra/modules/sqlDatabase.bicep` | Azure SQL Basic/S0 (auto-pauses in dev) |
| `infra/modules/redis.bicep` | Azure Cache Redis Basic C0 |
| `infra/modules/storage.bicep` | Blob Storage for product images |
| `infra/modules/managedIdentity.bicep` | User-assigned identities |
| `infra/parameters.dev.json` | Dev parameters |
| `infra/parameters.prod.json` | Prod parameters |
| `infra/README.md` | Infrastructure docs |

#### Docker Containers
| File | Description |
|------|-------------|
| `apps/api/Dockerfile` | Multi-stage Node.js for Medusa API |
| `apps/admin-test/Dockerfile` | Nginx static server for admin |
| `apps/vendor/Dockerfile` | Nginx static server for vendor portal |
| `apps/storefront/Dockerfile` | Next.js standalone build |
| `docker-compose.yml` | Local dev stack |
| `.dockerignore` | Optimized build context |

#### CI/CD Workflows
| File | Description |
|------|-------------|
| `.github/workflows/azure-deploy-dev.yml` | Auto-deploy on push |
| `.github/workflows/azure-deploy-prod.yml` | Manual deployment with approval |
| `.github/workflows/infra-deploy.yml` | Bicep validation + what-if previews |

#### Application Integration
| File | Description |
|------|-------------|
| `apps/api/medusa-config.ts` | Conditional Azure module loading |
| `apps/api/src/modules/azure-blob/index.ts` | Blob Storage file service |
| `apps/storefront/next.config.ts` | Azure Blob Storage image domains |

#### Deployment Tools
| File | Description |
|------|-------------|
| `deploy.sh` | Interactive deployment script |

### Azure Services Deployed

| Service | Dev Tier | Prod Tier | Idle Behavior | Monthly Cost |
|---------|----------|-----------|---------------|--------------|
| Azure SQL Database | GP_S_Gen5_1 (serverless) | S0 Standard | Auto-pauses after 1hr (dev) | $5–15 |
| Azure Cache for Redis | Basic C0 | Basic C0 | Always on (small) | ~$16 |
| Azure Blob Storage | Standard LRS | Standard LRS | Pay per GB stored | ~$5 |
| Azure Container Apps | Consumption | Consumption | **Scales to 0 replicas** | ~$0–30 |
| Azure Container Registry | Basic | Basic | Always on | ~$5 |
| Azure Key Vault | Standard | Standard | Free tier | ~$0 |
| Meilisearch | ACA container | ACA container | 1 replica | ~$5–10 |

### Scale-to-Zero Behavior

**All user-facing apps scale to 0 replicas when idle** (no requests for ~5 minutes):

- API: 0 → 5 replicas max
- Storefront: 0 → 3 replicas max
- Admin: 0 → 3 replicas max
- Vendor: 0 → 3 replicas max
- Meilisearch: 1 replica (search needs to stay warm)

**When idle:** You pay only for SQL (if serverless), Redis (~$16), Blob Storage (~$5), and Meilisearch (~$5-10). **Compute cost drops to ~$0.**

**When traffic arrives:** ACA cold-starts a container in 2-5 seconds, then autoscales based on concurrent requests and CPU usage.

## Deployment Steps

### 1. Prerequisites

```bash
# Install Azure CLI
brew install azure-cli  # macOS

# Login to Azure
az login
az account set --subscription "Your Subscription Name"
```

### 2. Configure GitHub Secrets (for CI/CD)

In your GitHub repository settings, add these secrets:

| Secret | How to Get |
|--------|-----------|
| `AZURE_CLIENT_ID` | `az ad sp create-for-rbac --name openstore-gha --role contributor` |
| `AZURE_TENANT_ID` | `az account show --query tenantId -o tsv` |
| `AZURE_SUBSCRIPTION_ID` | `az account show --query id -o tsv` |
| `SQL_ADMIN_PASSWORD` | Generate a strong password |
| `DEV_API_URL` | Output after first dev deployment |
| `PROD_API_URL` | Output after first prod deployment |

### 3. Deploy Infrastructure

#### Option A: Using the deploy script (recommended)

```bash
# Deploy to dev
SQL_ADMIN_PASSWORD='YourStrongPassword123!' ./deploy.sh dev eastus

# Deploy to production
SQL_ADMIN_PASSWORD='YourStrongPassword123!' ./deploy.sh prod eastus
```

#### Option B: Using Azure CLI directly

```bash
# Create resource group
az group create --name openstore-dev-rg --location eastus

# Deploy infrastructure
az deployment group create \
  --resource-group openstore-dev-rg \
  --template-file infra/main.bicep \
  --parameters infra/parameters.dev.json \
  --parameters sqlAdminPassword='YourStrongPassword123!'
```

### 4. Build and Push Containers

```bash
# Get ACR name
ACR_NAME=$(az acr list --resource-group openstore-dev-rg --query "[0].name" -o tsv)

# Login to ACR
az acr login --name $ACR_NAME

# Build and push all apps
for app in api storefront admin vendor; do
  docker build -f apps/$app/Dockerfile -t $ACR_NAME.azurecr.io/openstore/$app:dev .
  docker push $ACR_NAME.azurecr.io/openstore/$app:dev
done
```

### 5. Verify Deployment

```bash
# Get URLs
az deployment group show \
  --resource-group openstore-dev-rg \
  --name main \
  --query "properties.outputs"

# Health check
curl https://<api-url>/health
curl https://<storefront-url>
```

## Local Development

Start local services with Docker Compose:

```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432) — local equivalent of Azure SQL
- Redis (port 6379) — local equivalent of Azure Cache
- Meilisearch (port 7700) — search engine
- Azurite (port 10000) — Azure Storage emulator for blob testing

## Growth Path

| Milestone | Action | Cost Impact |
|-----------|--------|-------------|
| 100+ daily orders | Upgrade SQL to S2 or GP_Gen5_2 | +$30/mo |
| Cold starts too slow | Set `scaleToZero: false` (keep 1 replica) | +$15-20/mo per app |
| 1,000+ SKUs, diverse attributes | Add Cosmos DB | +$25-50/mo |
| Search feels slow | Add Azure AI Search Basic | +$75/mo |
| Global users (EU, Asia) | Add Azure Front Door | +$300/mo |
| 10,000+ orders/day | Add Service Bus Premium | +$100/mo |
| Black Friday traffic | Enable ACA max replicas 20, SQL read replicas | +$200-500/mo |

## Troubleshooting

### Container App won't start
```bash
az containerapp logs show --name openstore-api-dev --resource-group openstore-dev-rg --follow
```

### Cold start is too slow (2-5 seconds)
Set `scaleToZero: false` in `infra/modules/containerApps.bicep` to keep 1 replica always running:
```bash
az deployment group create \
  --resource-group openstore-dev-rg \
  --template-file infra/main.bicep \
  --parameters infra/parameters.dev.json \
  --parameters scaleToZero=false
```

### Can't connect to SQL Database
- Check firewall rules: `az sql server firewall-rule list --server openstore-sql-dev --resource-group openstore-dev-rg`
- Ensure `AllowAllAzureIps` rule exists

### Key Vault access denied
- Check managed identity has `Key Vault Secrets User` role
- Verify Key Vault reference syntax in Container App secrets

## Security

- ✅ Key Vault with purge protection
- ✅ Anonymous pull disabled on Container Registry
- ✅ TLS 1.2 minimum on all services
- ✅ Managed identities for service-to-service auth
- ✅ No secrets in source code
