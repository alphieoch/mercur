@description('Azure region')
param location string = resourceGroup().location

@description('Project name prefix')
param projectName string

@description('Environment name')
param environment string

@description('PostgreSQL admin username')
@secure()
param adminUsername string

@description('PostgreSQL admin password')
@secure()
param adminPassword string

@description('Tags')
param tags object

@description('Key Vault name for storing connection string')
param keyVaultName string

@description('PostgreSQL SKU tier')
@allowed([
  'Burstable'
  'GeneralPurpose'
  'MemoryOptimized'
])
param skuTier string = environment == 'prod' ? 'GeneralPurpose' : 'Burstable'

@description('PostgreSQL SKU name')
param skuName string = environment == 'prod' ? 'Standard_D2s_v3' : 'Standard_B1ms'

@description('Storage size in GB')
param storageSizeGB int = 32

@description('PostgreSQL version')
param postgresVersion string = '16'

// ---------------------------------------------------------------------------
// Azure Database for PostgreSQL Flexible Server
// Required for MedusaJS v2 (which requires PostgreSQL, not Azure SQL)
//
// Dev: Burstable B1ms (1 vCore, 2GB RAM) — ~$15-20/mo
// Prod: GeneralPurpose D2s_v3 (2 vCore, 8GB RAM) — ~$50-70/mo
// ---------------------------------------------------------------------------

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2024-11-01-preview' = {
  name: '${projectName}-postgres-${environment}'
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: postgresVersion
    administratorLogin: adminUsername
    administratorLoginPassword: adminPassword
    storage: {
      storageSizeGB: storageSizeGB
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: environment == 'prod' ? 35 : 7
      geoRedundantBackup: environment == 'prod' ? 'Enabled' : 'Disabled'
    }
    highAvailability: {
      mode: environment == 'prod' ? 'ZoneRedundant' : 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
  }
}

// Allow Azure services to access the PostgreSQL server
resource postgresFirewallRuleAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-11-01-preview' = {
  parent: postgresServer
  name: 'AllowAllAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '255.255.255.255'
  }
}

// Create the mercur database
resource mercurDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-11-01-preview' = {
  parent: postgresServer
  name: 'mercur'
}

// Store connection string in Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2024-04-01-preview' existing = {
  name: keyVaultName
}

var connectionString = 'postgresql://${adminUsername}:${adminPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/mercur?sslmode=require'

resource postgresConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = {
  parent: keyVault
  name: 'database-url'
  properties: {
    value: connectionString
  }
}

output postgresServerName string = postgresServer.name
output postgresServerFqdn string = postgresServer.properties.fullyQualifiedDomainName
output databaseName string = mercurDatabase.name
output connectionStringKeyVaultUri string = postgresConnectionStringSecret.properties.secretUri
