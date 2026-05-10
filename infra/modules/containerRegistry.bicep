@description('Azure region')
param location string = resourceGroup().location

@description('Globally unique ACR name (max 50 chars, alphanumeric)')
param acrName string

@description('Tags')
param tags object

@description('Key Vault name for storing ACR credentials')
param keyVaultName string

// ---------------------------------------------------------------------------
// Azure Container Registry — Basic tier for startup scale.
// Upgrade to Standard/Premium when you need geo-replication,
// content trust, or private endpoints.
// ---------------------------------------------------------------------------

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2024-11-01-preview' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    anonymousPullEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

// Store ACR login server in Key Vault for CI/CD reference
resource keyVault 'Microsoft.KeyVault/vaults@2024-04-01-preview' existing = {
  name: keyVaultName
}

resource acrLoginServerSecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = {
  parent: keyVault
  name: 'acr-login-server'
  properties: {
    value: containerRegistry.properties.loginServer
  }
}

output loginServer string = containerRegistry.properties.loginServer
output acrId string = containerRegistry.id
