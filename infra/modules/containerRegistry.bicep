@description('Azure region')
param location string = resourceGroup().location

@description('Globally unique ACR name (max 50 chars, alphanumeric)')
param acrName string

@description('Tags')
param tags object

@description('Key Vault name for storing ACR credentials')
param keyVaultName string

@description('API managed identity principal ID')
param apiIdentityPrincipalId string = ''

@description('Storefront managed identity principal ID')
param storefrontIdentityPrincipalId string = ''

@description('Admin managed identity principal ID')
param adminIdentityPrincipalId string = ''

@description('Vendor managed identity principal ID')
param vendorIdentityPrincipalId string = ''

@description('Deploy RBAC role assignments for managed identities')
param deployRoleAssignments bool = true

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

// ---------------------------------------------------------------------------
// Role Assignments — Grant managed identities AcrPull access
// Role: AcrPull (7f951dda-4ed3-4680-a7ca-43fe172d538d)
// ---------------------------------------------------------------------------

var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource apiAcrRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployRoleAssignments && !empty(apiIdentityPrincipalId)) {
  name: guid(containerRegistry.id, apiIdentityPrincipalId, acrPullRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: apiIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource storefrontAcrRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployRoleAssignments && !empty(storefrontIdentityPrincipalId)) {
  name: guid(containerRegistry.id, storefrontIdentityPrincipalId, acrPullRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: storefrontIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource adminAcrRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployRoleAssignments && !empty(adminIdentityPrincipalId)) {
  name: guid(containerRegistry.id, adminIdentityPrincipalId, acrPullRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: adminIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource vendorAcrRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (deployRoleAssignments && !empty(vendorIdentityPrincipalId)) {
  name: guid(containerRegistry.id, vendorIdentityPrincipalId, acrPullRoleId)
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: vendorIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output loginServer string = containerRegistry.properties.loginServer
output acrId string = containerRegistry.id
