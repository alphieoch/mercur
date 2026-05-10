@description('Azure region')
param location string = resourceGroup().location

@description('Project name prefix')
param projectName string

@description('Environment name')
param environment string

@description('Tags')
param tags object

// ---------------------------------------------------------------------------
// Azure Key Vault — Centralized secrets management
// Purge protection enabled per Azure security best practices
// Soft-delete enabled to allow recovery of accidentally deleted secrets
// ---------------------------------------------------------------------------

resource keyVault 'Microsoft.KeyVault/vaults@2024-04-01-preview' = {
  name: '${projectName}-${environment}-kv'
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    enablePurgeProtection: true
    softDeleteRetentionInDays: 90
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
