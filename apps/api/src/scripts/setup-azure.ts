import { BlobServiceClient } from '@azure/storage-blob'
import { SearchIndexClient, AzureKeyCredential } from '@azure/search-documents'
import sql from 'mssql'

// ---------------------------------------------------------------------------
// OpenStore Azure Setup Script
// One-time initialization of Azure resources after Bicep deployment.
// Run with: medusa exec ./src/scripts/setup-azure.ts
// ---------------------------------------------------------------------------

const config = {
  sql: {
    server: process.env.SQL_SERVER || '',
    database: process.env.SQL_DATABASE || 'openstore-db-dev',
    user: process.env.SQL_ADMIN_USERNAME || '',
    password: process.env.SQL_ADMIN_PASSWORD || '',
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
  },
  blob: {
    connectionString: process.env.BLOB_STORAGE_CONNECTION_STRING || '',
  },
  search: {
    endpoint: process.env.AI_SEARCH_ENDPOINT || '',
    apiKey: process.env.AI_SEARCH_API_KEY || '',
    indexName: process.env.AI_SEARCH_INDEX || 'products',
  },
}

async function setupSqlDatabase() {
  console.log('🔧 Setting up Azure SQL Database...')

  try {
    const pool = await sql.connect(config.sql)

    // Create required schemas and tables for Medusa v2
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'medusa')
      BEGIN
        EXEC('CREATE SCHEMA medusa')
      END
    `)

    console.log('✅ SQL Database schema verified')
    await pool.close()
  } catch (error) {
    console.error('❌ SQL setup failed:', error)
    throw error
  }
}

async function setupBlobStorage() {
  console.log('🔧 Setting up Azure Blob Storage...')

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(config.blob.connectionString)

    const containers = ['product-images', 'media', 'exports']
    for (const containerName of containers) {
      const containerClient = blobServiceClient.getContainerClient(containerName)
      await containerClient.createIfNotExists({
        access: containerName === 'exports' ? 'blob' : 'blob',
      })
      console.log(`✅ Container '${containerName}' ready`)
    }
  } catch (error) {
    console.error('❌ Blob Storage setup failed:', error)
    throw error
  }
}

async function setupAiSearch() {
  console.log('🔧 Setting up Azure AI Search...')

  try {
    const indexClient = new SearchIndexClient(
      config.search.endpoint,
      new AzureKeyCredential(config.search.apiKey)
    )

    await indexClient.createIndex({
      name: config.search.indexName,
      fields: [
        { name: 'id', type: 'Edm.String', key: true, filterable: true, sortable: true },
        { name: 'title', type: 'Edm.String', searchable: true, filterable: true, sortable: true },
        { name: 'description', type: 'Edm.String', searchable: true },
        { name: 'handle', type: 'Edm.String', filterable: true, sortable: true },
        { name: 'thumbnail', type: 'Edm.String' },
        { name: 'status', type: 'Edm.String', filterable: true },
        { name: 'tags', type: 'Collection(Edm.String)', filterable: true, facetable: true },
        { name: 'categories', type: 'Collection(Edm.String)', filterable: true, facetable: true },
        { name: 'created_at', type: 'Edm.DateTimeOffset', filterable: true, sortable: true },
        { name: 'updated_at', type: 'Edm.DateTimeOffset', filterable: true, sortable: true },
      ],
      suggesters: [
        {
          name: 'product-suggester',
          searchMode: 'analyzingInfixMatching',
          sourceFields: ['title', 'description'],
        },
      ],
    })

    console.log('✅ AI Search index created')
  } catch (error: any) {
    if (error.statusCode === 409) {
      console.log('ℹ️ AI Search index already exists')
      return
    }
    console.error('❌ AI Search setup failed:', error)
    throw error
  }
}

async function main() {
  console.log('🚀 OpenStore Azure Setup')
  console.log('========================\n')

  const tasks: Promise<void>[] = []

  if (config.sql.server) {
    tasks.push(setupSqlDatabase())
  } else {
    console.log('⏭️ Skipping SQL setup (no server configured)')
  }

  if (config.blob.connectionString) {
    tasks.push(setupBlobStorage())
  } else {
    console.log('⏭️ Skipping Blob Storage setup (no connection string)')
  }

  if (config.search.endpoint && config.search.apiKey) {
    tasks.push(setupAiSearch())
  } else {
    console.log('⏭️ Skipping AI Search setup (no endpoint configured)')
  }

  await Promise.all(tasks)

  console.log('\n✅ Azure setup complete!')
}

main().catch((error) => {
  console.error('Setup failed:', error)
  process.exit(1)
})
