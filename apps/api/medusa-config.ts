import { loadEnv } from '@medusajs/framework/utils'
import { withMercur } from '@mercurjs/core'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// ---------------------------------------------------------------------------
// OpenStore Medusa Configuration — Startup Tier
//
// Supports both local development and Azure production environments.
// Azure services are used when their connection strings are provided.
//
// Startup stack (cost-optimized for < 100 users):
// - Azure SQL Database (Serverless/Basic) — auto-pauses when idle
// - Azure Cache for Redis (Basic C0) — sessions, carts
// - Azure Blob Storage — product images
// - Meilisearch (container in ACA) — product search
// - Azure Container Apps — scales to 0 replicas when idle
//
// Removed (add later when scale demands it):
// - Azure Cosmos DB → PostgreSQL JSONB handles product catalogs
// - Azure AI Search → Meilisearch is free and fast enough
// - Azure Service Bus → Medusa built-in event bus
// - Azure Front Door → ACA built-in ingress + custom domain
// ---------------------------------------------------------------------------

const databaseUrl = process.env.DATABASE_URL || ''
const redisUrl = process.env.REDIS_URL || ''
const stripeConnectProviderPath = require.resolve('@mercurjs/payout-stripe-connect')

const mergeCors = (...groups: (string | undefined)[]) =>
  Array.from(
    new Set(
      groups
        .flatMap((group) => (group || '').split(','))
        .map((origin) => origin.trim())
        .filter(Boolean)
    )
  ).join(',')

const defaultStoreCors = 'http://localhost:3000,http://127.0.0.1:3000'
const defaultAdminCors = 'http://localhost:7002,http://127.0.0.1:7002'
const defaultVendorCors = 'http://localhost:7001,http://127.0.0.1:7001'
const defaultAuthCors = mergeCors(
  defaultStoreCors,
  defaultAdminCors,
  defaultVendorCors
)

const modules: any[] = [
  {
    resolve: '@mercurjs/core/modules/admin-ui',
    options: {
      appDir: '',
      path: '/dashboard',
      disable: true
    }
  },
  {
    resolve: '@mercurjs/core/modules/vendor-ui',
    options: {
      appDir: '',
      path: '/seller',
      disable: true
    }
  },
  {
    resolve: '@medusajs/medusa/payment',
    options: {
      providers: [
        {
          resolve: '@medusajs/medusa/payment-stripe',
          id: 'stripe',
          options: {
            apiKey: process.env.STRIPE_API_KEY,
            webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            capture: false,
            automatic_payment_methods: true,
          },
        },
      ],
    },
  },
  {
    resolve: '@mercurjs/core/modules/payout',
    options: {
      providers: [
        {
          resolve: stripeConnectProviderPath,
          id: 'stripe-connect',
          options: {
            apiKey: process.env.STRIPE_API_KEY,
            webhookSecret: process.env.STRIPE_PAYOUT_WEBHOOK_SECRET,
            accountValidation: {
              detailsSubmitted: true,
              chargesEnabled: true,
              payoutsEnabled: true,
              noOutstandingRequirements: true,
              requiredCapabilities: [],
            },
          },
        },
      ],
    },
  },
  {
    resolve: './modules/reviews',
  },
  {
    resolve: './modules/wishlist',
  },
]

// ---------------------------------------------------------------------------
// Azure Blob Storage (file uploads)
// Cheap and useful even at small scale. Replaces local filesystem.
// ---------------------------------------------------------------------------
if (process.env.BLOB_STORAGE_CONNECTION_STRING) {
  modules.push({
    key: 'azure_blob',
    resolve: './modules/azure-blob',
    options: {
      connectionString: process.env.BLOB_STORAGE_CONNECTION_STRING,
      containerName: process.env.BLOB_STORAGE_CONTAINER || 'product-images',
    }
  })
}

// ---------------------------------------------------------------------------
// Meilisearch (product search)
// Runs as a small container in ACA. Free, fast, and sufficient for
// product catalogs up to ~100K items. Upgrade to Azure AI Search
// when you need vector search or global geo-distribution.
// ---------------------------------------------------------------------------
modules.push({
  resolve: './modules/meilisearch',
  options: {
    host: process.env.MEILISEARCH_HOST || 'http://localhost:7700',
    apiKey: process.env.MEILISEARCH_API_KEY || 'masterKey',
  }
})

module.exports = withMercur({
  projectConfig: {
    databaseUrl: databaseUrl,
    redisUrl: redisUrl,
    http: {
      storeCors: mergeCors(defaultStoreCors, process.env.STORE_CORS),
      adminCors: mergeCors(defaultAdminCors, process.env.ADMIN_CORS),
      vendorCors: mergeCors(defaultVendorCors, process.env.VENDOR_CORS),
      authCors: mergeCors(defaultAuthCors, process.env.AUTH_CORS),
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  featureFlags: {
    seller_registration: true
  },
  modules,
})
