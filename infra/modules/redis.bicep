@description('Azure region')
param location string = resourceGroup().location

@description('Project name prefix')
param projectName string

@description('Environment name')
param environment string

@description('Tags')
param tags object

@description('Key Vault name for storing connection string')
param keyVaultName string

@description('Redis SKU: Basic (cheapest, no SLA), Standard, Premium')
@allowed([
  'Basic'
  'Standard'
  'Premium'
])
param redisSkuName string = 'Basic'

@description('Redis SKU family: C (Basic/Standard), P (Premium)')
@allowed([
  'C'
  'P'
])
param redisSkuFamily string = 'C'

@description('Redis capacity: 0=C0 (250MB), 1=C1 (1GB), etc. For P family use 1-5')
@allowed([
  0
  1
  2
  3
  4
  5
  6
])
param redisCapacity int = 0

// ---------------------------------------------------------------------------
// Azure Cache for Redis — Basic C0 (250MB, ~$16/mo)
// Smallest managed Redis tier. Upgrade to C1 or Standard when
// you need more memory, replication, or higher throughput.
// ---------------------------------------------------------------------------

resource redisCache 'Microsoft.Cache/redis@2024-11-01' = {
  name: '${projectName}-redis-${environment}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: redisSkuName
      family: redisSkuFamily
      capacity: redisCapacity
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'
    }
  }
}

// Store connection string in Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2024-04-01-preview' existing = {
  name: keyVaultName
}

var redisConnectionString = 'rediss://:${redisCache.listKeys().primaryKey}@${redisCache.properties.hostName}:6380'

resource redisConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = {
  parent: keyVault
  name: 'redis-url'
  properties: {
    value: redisConnectionString
  }
}

output redisCacheName string = redisCache.name
output redisHostName string = redisCache.properties.hostName
output connectionStringKeyVaultUri string = redisConnectionStringSecret.properties.secretUri
