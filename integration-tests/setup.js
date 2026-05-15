// medusaIntegrationTestRunner reads DB_* env vars at module load time.
// Ensure defaults are set before any test file imports @medusajs/test-utils.
process.env.DB_HOST = process.env.DB_HOST || "localhost"
process.env.DB_PORT = process.env.DB_PORT || "5432"
process.env.DB_USERNAME = process.env.DB_USERNAME || "openstore"
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "openstore"

const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")

MetadataStorage.clear()