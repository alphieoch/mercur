@description('Azure region')
param location string = resourceGroup().location

@description('Project name prefix')
param projectName string

@description('Environment name')
param environment string

@description('Tags')
param tags object

// ---------------------------------------------------------------------------
// User-assigned managed identities for each service
// Using separate identities enables least-privilege access per service
// ---------------------------------------------------------------------------

resource apiIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: '${projectName}-api-${environment}-mi'
  location: location
  tags: tags
}

resource storefrontIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: '${projectName}-storefront-${environment}-mi'
  location: location
  tags: tags
}

resource adminIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: '${projectName}-admin-${environment}-mi'
  location: location
  tags: tags
}

resource vendorIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: '${projectName}-vendor-${environment}-mi'
  location: location
  tags: tags
}

output apiIdentityId string = apiIdentity.id
output apiIdentityClientId string = apiIdentity.properties.clientId
output apiIdentityPrincipalId string = apiIdentity.properties.principalId

output storefrontIdentityId string = storefrontIdentity.id
output storefrontIdentityClientId string = storefrontIdentity.properties.clientId
output storefrontIdentityPrincipalId string = storefrontIdentity.properties.principalId

output adminIdentityId string = adminIdentity.id
output adminIdentityClientId string = adminIdentity.properties.clientId
output adminIdentityPrincipalId string = adminIdentity.properties.principalId

output vendorIdentityId string = vendorIdentity.id
output vendorIdentityClientId string = vendorIdentity.properties.clientId
output vendorIdentityPrincipalId string = vendorIdentity.properties.principalId
