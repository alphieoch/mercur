@description('Azure region')
param location string = resourceGroup().location

@description('Project name prefix')
param projectName string

@description('Environment name')
param environment string

@description('SQL Server admin username')
@secure()
param adminUsername string

@description('SQL Server admin password')
@secure()
param adminPassword string

@description('Tags')
param tags object

@description('Key Vault name for storing connection string')
param keyVaultName string

@description('Database tier: Basic ($5/mo), S0 ($15/mo), or GP_S_Gen5_1 (serverless, auto-pauses)')
@allowed([
  'Basic'
  'S0'
  'GP_S_Gen5_1'
])
param databaseSkuName string = environment == 'prod' ? 'S0' : 'GP_S_Gen5_1'

@description('Max database size in GB')
param maxSizeBytes int = environment == 'prod' ? 2147483648 : 2147483648 // 2GB

// ---------------------------------------------------------------------------
// Azure SQL Database — Startup Tier
// Dev: Serverless (auto-pauses after 1hr idle, ~$5-10/mo for light use)
// Prod: S0 standard tier (~$15/mo), upgrade to S2 or GP when needed
// ---------------------------------------------------------------------------

resource sqlServer 'Microsoft.Sql/servers@2024-05-01-preview' = {
  name: '${projectName}-sql-${environment}'
  location: location
  tags: tags
  properties: {
    administratorLogin: adminUsername
    administratorLoginPassword: adminPassword
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    version: '12.0'
  }
}

// Allow Azure services to access the SQL server
resource sqlFirewallRuleAzure 'Microsoft.Sql/servers/firewallRules@2024-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAllAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2024-05-01-preview' = {
  parent: sqlServer
  name: '${projectName}-db-${environment}'
  location: location
  tags: tags
  sku: {
    name: databaseSkuName
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: maxSizeBytes
    requestedBackupStorageRedundancy: 'Local'
  }
}

// Store connection string in Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2024-04-01-preview' existing = {
  name: keyVaultName
}

var connectionString = 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Initial Catalog=${sqlDatabase.name};Persist Security Info=False;User ID=${adminUsername};Password=${adminPassword};MultipleActiveResultSets=True;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;'

resource sqlConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = {
  parent: keyVault
  name: 'database-url'
  properties: {
    value: connectionString
  }
}

output sqlServerName string = sqlServer.name
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output databaseName string = sqlDatabase.name
output connectionStringKeyVaultUri string = sqlConnectionStringSecret.properties.secretUri
