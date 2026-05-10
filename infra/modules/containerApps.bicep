@description('Azure region')
param location string = resourceGroup().location

@description('Project name prefix')
param projectName string

@description('Environment name')
param environment string

@description('Tags')
param tags object

@description('Container Apps Environment ID')
param containerAppsEnvironmentId string

@description('ACR login server')
param acrLoginServer string

@description('API managed identity ID')
param apiIdentityId string

@description('Storefront managed identity ID')
param storefrontIdentityId string

@description('Admin managed identity ID')
param adminIdentityId string

@description('Vendor managed identity ID')
param vendorIdentityId string

@description('SQL connection string Key Vault secret URI')
param sqlConnectionStringKeyVaultUri string

@description('Redis connection string Key Vault secret URI')
param redisConnectionStringKeyVaultUri string

@description('Blob Storage connection string Key Vault secret URI')
param blobStorageConnectionStringKeyVaultUri string

@description('Scale-to-zero: min replicas for user-facing apps (0 = scales to zero when idle)')
param scaleToZero bool = true

// ---------------------------------------------------------------------------
// Container Apps — Startup Tier with Scale-to-Zero
//
// API, Storefront, Admin, Vendor: Scale to 0 when idle, burst to 5 max.
// Meilisearch: Stays at 1 replica (search needs to be warm).
//
// This means when no one is using the site, you pay ~$0 for compute.
// Only SQL (if serverless) and Redis have baseline costs.
// ---------------------------------------------------------------------------

var apiMinReplicas = scaleToZero ? 0 : 1
var uiMinReplicas = scaleToZero ? 0 : 1
var meilisearchMinReplicas = 1

var apiMaxReplicas = environment == 'prod' ? 5 : 2
var uiMaxReplicas = environment == 'prod' ? 3 : 2
var meilisearchMaxReplicas = 1

// --- API Container App (Medusa Backend) ---
resource apiApp 'Microsoft.App/containerApps@2024-10-02-preview' = {
  name: '${projectName}-api-${environment}'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${apiIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 9000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          identity: apiIdentityId
        }
      ]
      secrets: [
        {
          name: 'database-url'
          keyVaultUrl: sqlConnectionStringKeyVaultUri
          identity: apiIdentityId
        }
        {
          name: 'redis-url'
          keyVaultUrl: redisConnectionStringKeyVaultUri
          identity: apiIdentityId
        }
        {
          name: 'blob-storage-connection-string'
          keyVaultUrl: blobStorageConnectionStringKeyVaultUri
          identity: apiIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: '${acrLoginServer}/${projectName}/api:${environment}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'NODE_ENV', value: environment == 'prod' ? 'production' : 'development' }
            { name: 'PORT', value: '9000' }
            { name: 'DATABASE_URL', secretRef: 'database-url' }
            { name: 'REDIS_URL', secretRef: 'redis-url' }
            { name: 'MEILISEARCH_HOST', value: 'http://localhost:7700' }
            { name: 'MEILISEARCH_API_KEY', value: 'masterKey' }
            { name: 'BLOB_STORAGE_CONNECTION_STRING', secretRef: 'blob-storage-connection-string' }
            { name: 'STORE_CORS', value: '*' }
            { name: 'ADMIN_CORS', value: '*' }
            { name: 'VENDOR_CORS', value: '*' }
            { name: 'AUTH_CORS', value: '*' }
            { name: 'JWT_SECRET', secretRef: 'database-url' }
            { name: 'COOKIE_SECRET', secretRef: 'database-url' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 9000
              }
              initialDelaySeconds: 30
              periodSeconds: 10
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 9000
              }
              initialDelaySeconds: 10
              periodSeconds: 5
            }
          ]
        }
      ]
      scale: {
        minReplicas: apiMinReplicas
        maxReplicas: apiMaxReplicas
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
          {
            name: 'cpu-rule'
            custom: {
              type: 'cpu'
              metadata: {
                type: 'Utilization'
                value: '70'
              }
            }
          }
        ]
      }
    }
  }
}

// --- Meilisearch Container App (Search) ---
// Runs as a separate container so API can scale to 0 independently.
// Uses getmeili/meilisearch:latest — small memory footprint.
resource meilisearchApp 'Microsoft.App/containerApps@2024-10-02-preview' = {
  name: '${projectName}-meilisearch-${environment}'
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      ingress: {
        external: false
        targetPort: 7700
        transport: 'auto'
      }
      secrets: [
        {
          name: 'meili-master-key'
          value: '@Microsoft.KeyVault(VaultName=${projectName}-${environment}-kv;SecretName=meili-master-key)'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'meilisearch'
          image: 'getmeili/meilisearch:v1.8'
          resources: {
            cpu: json('0.25')
            memory: '512Mi'
          }
          env: [
            { name: 'MEILI_MASTER_KEY', secretRef: 'meili-master-key' }
            { name: 'MEILI_NO_ANALYTICS', value: 'true' }
          ]
          volumeMounts: [
            {
              volumeName: 'meili-data'
              mountPath: '/meili_data'
            }
          ]
        }
      ]
      volumes: [
        {
          name: 'meili-data'
          storageType: 'EmptyDir'
        }
      ]
      scale: {
        minReplicas: meilisearchMinReplicas
        maxReplicas: meilisearchMaxReplicas
      }
    }
  }
}

// --- Storefront Container App (Next.js) ---
resource storefrontApp 'Microsoft.App/containerApps@2024-10-02-preview' = {
  name: '${projectName}-storefront-${environment}'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${storefrontIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
      }
      registries: [
        {
          server: acrLoginServer
          identity: storefrontIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'storefront'
          image: '${acrLoginServer}/${projectName}/storefront:${environment}'
          resources: {
            cpu: json('0.25')
            memory: '512Mi'
          }
          env: [
            { name: 'NODE_ENV', value: environment == 'prod' ? 'production' : 'development' }
            { name: 'PORT', value: '3000' }
            { name: 'NEXT_PUBLIC_MEDUSA_BACKEND_URL', value: 'https://${apiApp.properties.configuration.ingress.fqdn}' }
          ]
        }
      ]
      scale: {
        minReplicas: uiMinReplicas
        maxReplicas: uiMaxReplicas
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '30'
              }
            }
          }
        ]
      }
    }
  }
}

// --- Admin Container App (Vite/React) ---
resource adminApp 'Microsoft.App/containerApps@2024-10-02-preview' = {
  name: '${projectName}-admin-${environment}'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${adminIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'auto'
      }
      registries: [
        {
          server: acrLoginServer
          identity: adminIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'admin'
          image: '${acrLoginServer}/${projectName}/admin:${environment}'
          resources: {
            cpu: json('0.25')
            memory: '256Mi'
          }
          env: [
            { name: 'NODE_ENV', value: environment == 'prod' ? 'production' : 'development' }
          ]
        }
      ]
      scale: {
        minReplicas: uiMinReplicas
        maxReplicas: uiMaxReplicas
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '30'
              }
            }
          }
        ]
      }
    }
  }
}

// --- Vendor Container App (Vite/React) ---
resource vendorApp 'Microsoft.App/containerApps@2024-10-02-preview' = {
  name: '${projectName}-vendor-${environment}'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${vendorIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'auto'
      }
      registries: [
        {
          server: acrLoginServer
          identity: vendorIdentityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'vendor'
          image: '${acrLoginServer}/${projectName}/vendor:${environment}'
          resources: {
            cpu: json('0.25')
            memory: '256Mi'
          }
          env: [
            { name: 'NODE_ENV', value: environment == 'prod' ? 'production' : 'development' }
          ]
        }
      ]
      scale: {
        minReplicas: uiMinReplicas
        maxReplicas: uiMaxReplicas
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '30'
              }
            }
          }
        ]
      }
    }
  }
}

output apiFqdn string = apiApp.properties.configuration.ingress.fqdn
output apiUrl string = 'https://${apiApp.properties.configuration.ingress.fqdn}'

output meilisearchFqdn string = meilisearchApp.properties.configuration.ingress.fqdn
output meilisearchUrl string = 'https://${meilisearchApp.properties.configuration.ingress.fqdn}'

output storefrontFqdn string = storefrontApp.properties.configuration.ingress.fqdn
output storefrontUrl string = 'https://${storefrontApp.properties.configuration.ingress.fqdn}'

output adminFqdn string = adminApp.properties.configuration.ingress.fqdn
output adminUrl string = 'https://${adminApp.properties.configuration.ingress.fqdn}'

output vendorFqdn string = vendorApp.properties.configuration.ingress.fqdn
output vendorUrl string = 'https://${vendorApp.properties.configuration.ingress.fqdn}'
