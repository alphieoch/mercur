# OpenStore Azure Infrastructure — Startup Tier

This directory contains Infrastructure as Code (IaC) for deploying the OpenStore marketplace to Microsoft Azure using Bicep templates.

**Designed for < 100 users with aggressive cost optimization and scale-to-zero behavior.**

## Architecture

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
        (No Cosmos DB needed until 10K+ SKUs)
```

## Why This Stack?

For a marketplace with fewer than 100 concurrent users, the "enterprise" stack (Hyperscale SQL, Cosmos DB, AI Search, Service Bus, Front Door) costs **~$4,250/month** — completely unnecessary.

This startup tier costs **~$50–80/month** in production by:

- Using **Azure SQL Basic/S0** instead of Hyperscale
- Using **PostgreSQL JSONB** instead of Cosmos DB for product catalogs
- Using **Meilisearch in a container** instead of Azure AI Search
- Using **Medusa's built-in event bus** instead of Service Bus
- Using **ACA built-in ingress** instead of Front Door
- **Scaling all apps to 0 replicas** when idle (only Meilisearch stays at 1)

## Prerequisites

- [Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli) (>= 2.50)
- [Bicep CLI](https://docs.microsoft.com/azure/azure-resource-manager/bicep/install) (via `az bicep install`)
- Azure subscription with Owner or Contributor + User Access Administrator roles

## Quick Start

### 1. Login to Azure

```bash
az login
az account set --subscription "Your Subscription Name"
```

### 2. Create Resource Group (first time only)

```bash
az group create \
  --name openstore-dev-rg \
  --location eastus
```

### 3. Deploy Infrastructure

```bash
# Dev environment
az deployment group create \
  --resource-group openstore-dev-rg \
  --template-file main.bicep \
  --parameters parameters.dev.json \
  --parameters sqlAdminPassword='YourStrongPassword123!'

# Production environment
az deployment group create \
  --resource-group openstore-prod-rg \
  --template-file main.bicep \
  --parameters parameters.prod.json \
  --parameters sqlAdminPassword='YourStrongPassword123!'
```

### 4. What-If (Preview Changes)

```bash
az deployment group what-if \
  --resource-group openstore-dev-rg \
  --template-file main.bicep \
  --parameters parameters.dev.json
```

## Parameter Files

| File | Environment | Purpose |
|------|-------------|---------|
| `parameters.dev.json` | Development | Serverless SQL (auto-pause), scale-to-zero |
| `parameters.prod.json` | Production | S0 SQL, scale-to-zero, 2-5 max replicas |

## Modules

| Module | Azure Service | Purpose |
|--------|-------------|---------|
| `containerRegistry.bicep` | Container Registry (Basic) | Stores Docker images |
| `containerAppsEnvironment.bicep` | Container Apps Environment | Shared runtime |
| `containerApps.bicep` | Container Apps | API, Storefront, Admin, Vendor, Meilisearch |
| `sqlDatabase.bicep` | SQL Database (Basic/S0) | Transactional data |
| `redis.bicep` | Cache for Redis (Basic C0) | Sessions, carts |
| `storage.bicep` | Blob Storage (Standard LRS) | Product images |
| `keyVault.bicep` | Key Vault (Standard) | Secrets management |
| `managedIdentity.bicep` | User-Assigned Managed Identities | Secure service auth |

## Scale-to-Zero Behavior

All user-facing Container Apps are configured to **scale to 0 replicas** when idle:

| App | Min Replicas | Max Replicas | Idle Cost |
|-----|-------------|-------------|-----------|
| API | 0 | 2 (dev) / 5 (prod) | $0 |
| Storefront | 0 | 2 (dev) / 3 (prod) | $0 |
| Admin | 0 | 2 (dev) / 3 (prod) | $0 |
| Vendor | 0 | 2 (dev) / 3 (prod) | $0 |
| Meilisearch | 1 | 1 | ~$5-10/mo |

When a request comes in, ACA cold-starts a container in ~2-5 seconds.

## Cost Estimate

### Development (~$15–25/mo)

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Azure SQL | GP_S_Gen5_1 (serverless, auto-pauses) | ~$5–10 |
| Azure Redis | Basic C0 | ~$16 |
| Container Apps | Consumption (scales to 0) | ~$0–5 |
| Blob Storage | Standard LRS | ~$1–2 |
| Key Vault | Standard | ~$0 |
| ACR | Basic | ~$5 |
| **Total** | | **~$15–25** |

### Production (~$50–80/mo)

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Azure SQL | S0 Standard | ~$15 |
| Azure Redis | Basic C0 | ~$16 |
| Container Apps | Consumption (scales to 0) | ~$10–30 |
| Blob Storage | Standard LRS | ~$5 |
| Key Vault | Standard | ~$0 |
| ACR | Basic | ~$5 |
| Meilisearch | ACA container (1 replica) | ~$5–10 |
| **Total** | | **~$50–80** |

### When to Upgrade

| Milestone | Action | New Monthly Cost |
|-----------|--------|-----------------|
| 100+ daily orders | Upgrade SQL to S2 or GP_Gen5_2 | +$30 |
| 1,000+ SKUs with diverse attributes | Add Cosmos DB | +$25–50 |
| Search feels slow | Add Azure AI Search Basic | +$75 |
| Global users (EU, Asia) | Add Azure Front Door | +$300 |
| 10,000+ orders/day | Add Service Bus Premium | +$100 |
| Black Friday traffic | Enable ACA autoscaling, SQL read replicas | +$200–500 |

## Secrets Management

All secrets are stored in Azure Key Vault and referenced by Container Apps using managed identities. No secrets are stored in environment variables or source code.

| Secret | Description |
|--------|-------------|
| `database-url` | SQL Database connection string |
| `redis-url` | Redis connection string |
| `blob-storage-connection-string` | Blob Storage connection string |
| `acr-login-server` | Container Registry login server |

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `azure-deploy-dev.yml` | Push to main/develop | Build, push, deploy to dev |
| `azure-deploy-prod.yml` | Manual (workflow_dispatch) | Build, push, deploy to prod |
| `infra-deploy.yml` | PR/push to infra/** | Validate and deploy Bicep |

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AZURE_CLIENT_ID` | Service principal client ID |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `SQL_ADMIN_PASSWORD` | SQL Server admin password |
| `DEV_API_URL` | Dev API URL for storefront build |
| `PROD_API_URL` | Prod API URL for storefront build |

## Local Development

Use Docker Compose for local services:

```bash
docker-compose up -d
```

This starts PostgreSQL, Redis, Meilisearch, and Azurite (Azure Storage emulator).

## Troubleshooting

### Container App fails to start
```bash
az containerapp logs show \
  --name openstore-api-dev \
  --resource-group openstore-dev-rg \
  --follow
```

### Key Vault access denied
Ensure the managed identity has `Key Vault Secrets User` role on the Key Vault.

### SQL connection fails
Check that the SQL Server firewall allows Azure services (`AllowAllAzureIps` rule).

### Cold start latency
If 2-5 second cold starts are unacceptable, set `scaleToZero: false` in the Container Apps module to keep 1 replica always running (~$15-20/mo extra per app).

## Security

- ✅ Purge protection enabled on Key Vault
- ✅ Anonymous pull disabled on Container Registry
- ✅ TLS 1.2 minimum on all services
- ✅ Managed identities for service-to-service auth
- ✅ No secrets in source code or environment variables

## References

- [Azure Container Apps](https://docs.microsoft.com/azure/container-apps/)
- [Azure SQL Database](https://docs.microsoft.com/azure/azure-sql/database/)
- [Bicep Documentation](https://docs.microsoft.com/azure/azure-resource-manager/bicep/)
