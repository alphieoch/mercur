import { Module } from '@medusajs/framework/utils'
import { SearchUtils } from '@medusajs/types'
import { SearchIndexClient, SearchClient, AzureKeyCredential } from '@azure/search-documents'

// ---------------------------------------------------------------------------
// Azure AI Search Module for Medusa v2
// Provides full-text search, faceted navigation, and vector search
// for product discovery at eBay-scale.
// ---------------------------------------------------------------------------

type AzureSearchOptions = {
  endpoint: string
  apiKey: string
  indexName: string
}

class AzureSearchService extends SearchUtils.AbstractSearchService {
  protected readonly client_: SearchClient
  protected readonly indexClient_: SearchIndexClient
  protected readonly indexName_: string
  isDefault = false

  constructor({ logger }: { logger: any }, options: AzureSearchOptions) {
    super(arguments[0], options)

    this.indexName_ = options.indexName
    this.indexClient_ = new SearchIndexClient(
      options.endpoint,
      new AzureKeyCredential(options.apiKey)
    )
    this.client_ = new SearchClient(
      options.endpoint,
      options.indexName,
      new AzureKeyCredential(options.apiKey)
    )
  }

  async createIndex(indexName: string, settings: SearchUtils.IndexSettings): Promise<void> {
    try {
      await this.indexClient_.createIndex({
        name: indexName,
        fields: [
          { name: 'id', type: 'Edm.String', key: true, filterable: true, sortable: true },
          { name: 'title', type: 'Edm.String', searchable: true, filterable: true, sortable: true },
          { name: 'description', type: 'Edm.String', searchable: true },
          { name: 'handle', type: 'Edm.String', filterable: true, sortable: true },
          { name: 'thumbnail', type: 'Edm.String', filterable: false },
          { name: 'variants', type: 'Collection(Edm.ComplexType)', fields: [
            { name: 'sku', type: 'Edm.String', filterable: true },
            { name: 'prices', type: 'Collection(Edm.ComplexType)', fields: [
              { name: 'amount', type: 'Edm.Double', filterable: true, sortable: true },
              { name: 'currency_code', type: 'Edm.String', filterable: true },
            ]},
          ]},
          { name: 'tags', type: 'Collection(Edm.String)', filterable: true, facetable: true },
          { name: 'categories', type: 'Collection(Edm.String)', filterable: true, facetable: true },
          { name: 'status', type: 'Edm.String', filterable: true },
          { name: 'created_at', type: 'Edm.DateTimeOffset', filterable: true, sortable: true },
          { name: 'updated_at', type: 'Edm.DateTimeOffset', filterable: true, sortable: true },
        ],
        suggesters: [
          {
            name: 'sg',
            searchMode: 'analyzingInfixMatching',
            sourceFields: ['title', 'description'],
          },
        ],
      })
    } catch (error: any) {
      if (error.statusCode === 409) {
        // Index already exists
        return
      }
      throw error
    }
  }

  async addDocuments(indexName: string, documents: any[]): Promise<void> {
    const batch = documents.map((doc) => ({
      ...doc,
      '@search.action': 'upload',
    }))
    await this.client_.mergeOrUploadDocuments(batch)
  }

  async replaceDocuments(indexName: string, documents: any[]): Promise<void> {
    await this.addDocuments(indexName, documents)
  }

  async deleteDocument(indexName: string, documentId: string): Promise<void> {
    await this.client_.deleteDocuments([{ id: documentId }])
  }

  async search(indexName: string, query: string, options: SearchUtils.SearchOptions): Promise<SearchUtils.SearchResults> {
    const searchResults = await this.client_.search(query, {
      top: options.pagination?.limit || 20,
      skip: options.pagination?.offset || 0,
      filter: this.buildFilter_(options.filters),
      facets: options.facets || ['tags', 'categories'],
      orderBy: options.sort ? [options.sort] : undefined,
    })

    const hits: any[] = []
    for await (const result of searchResults.results) {
      hits.push(result.document)
    }

    return {
      hits,
      estimatedTotalCount: searchResults.count || hits.length,
    }
  }

  private buildFilter_(filters: Record<string, any> | undefined): string | undefined {
    if (!filters) return undefined
    const conditions: string[] = []
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        conditions.push(`${key} in (${value.map((v) => `'${v}'`).join(',')})`)
      } else {
        conditions.push(`${key} eq '${value}'`)
      }
    }
    return conditions.length > 0 ? conditions.join(' and ') : undefined
  }

  async updateSettings(indexName: string, settings: SearchUtils.IndexSettings): Promise<void> {
    // Settings updates handled via index recreation or Azure portal
  }

  async deleteIndex(indexName: string): Promise<void> {
    await this.indexClient_.deleteIndex(indexName)
  }
}

export default Module('azure-search', {
  service: AzureSearchService,
})
