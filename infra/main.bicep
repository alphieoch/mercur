targetScope = 'subscription'

// ---------------------------------------------------------------------------
// OpenStore Azure Infrastructure — Startup Tier (Cost-Optimized)
// ---------------------------------------------------------------------------
// Designed for < 100 users with aggressive scale-to-zero behavior.
// All services autoscale or auto-pause when idle to minimize cost.
//
// Monthly estimate: ~$15-25 (dev) | ~$50-80 (prod)
//
// Architecture:
// - Azure SQL Database (Serverless/Basic) — auto-pauses when idle
// - Azure Cache for Redis (Basic C0) — sessions/carts
// - Azure Blob Storage (Standard LRS) — product images
// - Azure Container Apps (Consumption) — scales to 0 replicas
//   - API (Medusa), Storefront (Next.js), Admin, Vendor, Meilisearch
// - Azure Container Registry (Basic) — container images
// - Azure Key Vault (Standard) — secrets
//
// Removed (add when scale demands it):
// - Cosmos DB → PostgreSQL JSONB handles product catalogs at this scale
// - AI Search → Meilisearch container (~$0 when scaled to 0)
// - Service Bus → Medusa built-in event bus
// - Front Door → ACA built-in ingress + custom domain
// ---------------------------------------------------------------------------

@description('Environment name (dev, staging, prod)')
param environment string = 'dev'

@description('Azure region for resources')
param location string = 'eastus'

@description('Project name prefix for resources')
param projectName string = 'openstore'

@description('SQL Server admin username')
@secure()
param sqlAdminUsername string

@description('SQL Server admin password')
@secure()
param sqlAdminPassword string

@description('Tags to apply to all resources')
param tags object = {
  Project: 'OpenStore'
  Environment: environment
  ManagedBy: 'Bicep'
}

// ---------------------------------------------------------------------------
// Naming conventions
// ---------------------------------------------------------------------------
var resourceGroupName = '${projectName}-${environment}-rg'
var acrName = '${projectName}${environment}acr'

// ---------------------------------------------------------------------------
// Resource Group
// ---------------------------------------------------------------------------
resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-11-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// ---------------------------------------------------------------------------
// Managed Identities
// ---------------------------------------------------------------------------
module managedIdentity 'modules/managedIdentity.bicep' = {
  name: 'managedIdentityDeployment'
  scope: resourceGroup
  params: {
    location: location
    projectName: projectName
    environment: environment
    tags: tags
  }
}

// ---------------------------------------------------------------------------
// Key Vault
// ---------------------------------------------------------------------------
module keyVault 'modules/keyVault.bicep' = {
  name: 'keyVaultDeployment'
  scope: resourceGroup
  params: {
    location: location
    projectName: projectName
    environment: environment
    tags: tags
  }
}

// ---------------------------------------------------------------------------
// Azure Container Registry (Basic tier — sufficient for startup scale)
// ---------------------------------------------------------------------------
module containerRegistry 'modules/containerRegistry.bicep' = {
  name: 'containerRegistryDeployment'
  scope: resourceGroup
  params: {
    location: location
    acrName: acrName
    tags: tags
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

// ---------------------------------------------------------------------------
// Azure SQL Database (Serverless — auto-pauses after 1hr idle)
// ---------------------------------------------------------------------------
module sqlDatabase 'modules/sqlDatabase.bicep' = {
  name: 'sqlDatabaseDeployment'
  scope: resourceGroup
  params: {
    location: location
    projectName: projectName
    environment: environment
    adminUsername: sqlAdminUsername
    adminPassword: sqlAdminPassword
    tags: tags
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

// ---------------------------------------------------------------------------
// Azure Cache for Redis (Basic C0 — smallest tier, can upgrade later)
// ---------------------------------------------------------------------------
module redis 'modules/redis.bicep' = {
  name: 'redisDeployment'
  scope: resourceGroup
  params: {
    location: location
    projectName: projectName
    environment: environment
    tags: tags
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

// ---------------------------------------------------------------------------
// Azure Blob Storage
// ---------------------------------------------------------------------------
module storage 'modules/storage.bicep' = {
  name: 'storageDeployment'
  scope: resourceGroup
  params: {
    location: location
    projectName: projectName
    environment: environment
    tags: tags
    keyVaultName: keyVault.outputs.keyVaultName
  }
}

// ---------------------------------------------------------------------------
// Container Apps Environment
// ---------------------------------------------------------------------------
module containerAppsEnvironment 'modules/containerAppsEnvironment.bicep' = {
  name: 'containerAppsEnvironmentDeployment'
  scope: resourceGroup
  params: {
    location: location
    projectName: projectName
    environment: environment
    tags: tags
  }
}

// ---------------------------------------------------------------------------
// Container Apps — API, Storefront, Admin, Vendor + Meilisearch
// All scale to 0 replicas when idle (except Meilisearch which stays at 1)
// ---------------------------------------------------------------------------
module containerApps 'modules/containerApps.bicep' = {
  name: 'containerAppsDeployment'
  scope: resourceGroup
  params: {
    location: location
    projectName: projectName
    environment: environment
    tags: tags
    containerAppsEnvironmentId: containerAppsEnvironment.outputs.environmentId
    acrLoginServer: containerRegistry.outputs.loginServer
    apiIdentityId: managedIdentity.outputs.apiIdentityId
    storefrontIdentityId: managedIdentity.outputs.storefrontIdentityId
    adminIdentityId: managedIdentity.outputs.adminIdentityId
    vendorIdentityId: managedIdentity.outputs.vendorIdentityId
    sqlConnectionStringKeyVaultUri: sqlDatabase.outputs.connectionStringKeyVaultUri
    redisConnectionStringKeyVaultUri: redis.outputs.connectionStringKeyVaultUri
    blobStorageConnectionStringKeyVaultUri: storage.outputs.connectionStringKeyVaultUri
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------
output resourceGroupName string = resourceGroup.name
output acrLoginServer string = containerRegistry.outputs.loginServer
output apiUrl string = containerApps.outputs.apiUrl
output storefrontUrl string = containerApps.outputs.storefrontUrl
output adminUrl string = containerApps.outputs.adminUrl
output vendorUrl string = containerApps.outputs.vendorUrl
output meilisearchUrl string = containerApps.outputs.meilisearchUrl
output sqlServerFqdn string = sqlDatabase.outputs.sqlServerFqdn
