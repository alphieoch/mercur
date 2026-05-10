@description('Azure region')
param location string = resourceGroup().location

@description('Project name prefix')
param projectName string

@description('Environment name')
param environment string

@description('Tags')
param tags object

@description('API managed identity principal ID')
param apiIdentityPrincipalId string = ''

@description('Storefront managed identity principal ID')
param storefrontIdentityPrincipalId string = ''

@description('Admin managed identity principal ID')
param adminIdentityPrincipalId string = ''

@description('Vendor managed identity principal ID')
param vendorIdentityPrincipalId string = ''

@description('JWT secret value')
@secure()
param jwtSecret string = ''

@description('Cookie secret value')
@secure()
param cookieSecret string = ''

// ---------------------------------------------------------------------------
// Azure Key Vault — Centralized secrets management
// Purge protection enabled per Azure security best practices
// Soft-delete enabled to allow recovery of accidentally deleted secrets
// ---------------------------------------------------------------------------

resource keyVault 'Microsoft.KeyVault/vaults@2024-04-01-preview' = {
  name: take('${projectName}${environment}kv${uniqueString(subscription().subscriptionId, projectName, environment)}', 24)
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

// ---------------------------------------------------------------------------
// Role Assignments — Grant managed identities access to Key Vault secrets
// Role: Key Vault Secrets User (4633458b-17de-408a-b874-0445c86b69e6)
// ---------------------------------------------------------------------------

var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource apiKeyVaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(apiIdentityPrincipalId)) {
  name: guid(keyVault.id, apiIdentityPrincipalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: apiIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource storefrontKeyVaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(storefrontIdentityPrincipalId)) {
  name: guid(keyVault.id, storefrontIdentityPrincipalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: storefrontIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource adminKeyVaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(adminIdentityPrincipalId)) {
  name: guid(keyVault.id, adminIdentityPrincipalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: adminIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource vendorKeyVaultRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(vendorIdentityPrincipalId)) {
  name: guid(keyVault.id, vendorIdentityPrincipalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: vendorIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// Store JWT and cookie secrets in Key Vault
// Use provided values or generate defaults using uniqueString
var defaultJwtSecret = uniqueString(keyVault.id, subscription().subscriptionId, 'jwt')
var defaultCookieSecret = uniqueString(keyVault.id, subscription().subscriptionId, 'cookie')

resource jwtSecretResource 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = {
  parent: keyVault
  name: 'jwt-secret'
  properties: {
    value: !empty(jwtSecret) ? jwtSecret : defaultJwtSecret
  }
}

resource cookieSecretResource 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = {
  parent: keyVault
  name: 'cookie-secret'
  properties: {
    value: !empty(cookieSecret) ? cookieSecret : defaultCookieSecret
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output jwtSecretUri string = jwtSecretResource.properties.secretUri
output cookieSecretUri string = cookieSecretResource.properties.secretUri
