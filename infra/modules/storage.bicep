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

@description('Storage SKU: Standard_LRS, Standard_GRS, Standard_ZRS, Premium_LRS')
@allowed([
  'Standard_LRS'
  'Standard_GRS'
  'Standard_ZRS'
  'Premium_LRS'
])
param storageSkuName string = environment == 'prod' ? 'Standard_GRS' : 'Standard_LRS'

// ---------------------------------------------------------------------------
// Azure Blob Storage — Product images, media files, exports.
// Hot tier for frequently accessed product images.
// GRS in production for geo-redundancy.
// ---------------------------------------------------------------------------

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: '${projectName}stg${environment}'
  location: location
  tags: tags
  sku: {
    name: storageSkuName
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: true
    allowSharedKeyAccess: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

resource blobServices 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    cors: {
      corsRules: [
        {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'HEAD', 'OPTIONS']
          allowedHeaders: ['*']
          exposedHeaders: ['*']
          maxAgeInSeconds: 3600
        }
      ]
    }
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

resource productImagesContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: 'product-images'
  properties: {
    publicAccess: 'Blob'
  }
}

resource mediaContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: 'media'
  properties: {
    publicAccess: 'Blob'
  }
}

resource exportsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: 'exports'
  properties: {
    publicAccess: 'None'
  }
}

// Store connection string in Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2024-04-01-preview' existing = {
  name: keyVaultName
}

var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'

resource storageConnectionStringSecret 'Microsoft.KeyVault/vaults/secrets@2024-04-01-preview' = {
  parent: keyVault
  name: 'blob-storage-connection-string'
  properties: {
    value: storageConnectionString
  }
}

output storageAccountName string = storageAccount.name
output storageAccountEndpoint string = storageAccount.properties.primaryEndpoints.blob
output connectionStringKeyVaultUri string = storageConnectionStringSecret.properties.secretUri
