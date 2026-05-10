import Typesense from 'typesense'

import { IndexType, TypesenseEntity, TypesenseSearchResult } from './types'

type ModuleOptions = {
  host: string
  port: number
  protocol: string
  apiKey: string
}

const SEARCHABLE_ATTRIBUTES = [
  'title',
  'subtitle',
  'description',
  'tags.value',
  'type.value',
  'categories.name',
  'variants.title',
  'seller.name',
  'seller.handle',
]

const FILTERABLE_ATTRIBUTES = [
  'seller.status',
  'seller.handle',
  'seller.country_code',
  'seller.fulfillment_types',
  'categories.id',
  'categories.name',
  'variants.prices.amount',
  'status',
]

const SORTABLE_ATTRIBUTES = ['title', 'variants.prices.amount']

const SCHEMA = {
  name: IndexType.PRODUCT,
  enable_nested_fields: true,
  fields: [
    { name: 'id', type: 'string' as const, facet: false },
    { name: 'title', type: 'string' as const, facet: false, optional: true },
    { name: 'subtitle', type: 'string' as const, facet: false, optional: true },
    { name: 'description', type: 'string' as const, facet: false, optional: true },
    { name: 'handle', type: 'string' as const, facet: false, optional: true },
    { name: 'thumbnail', type: 'string' as const, facet: false, optional: true },
    { name: 'status', type: 'string' as const, facet: true, optional: true },
    { name: 'categories.id', type: 'string[]' as const, facet: true, optional: true },
    { name: 'categories.name', type: 'string[]' as const, facet: true, optional: true },
    { name: 'tags.value', type: 'string[]' as const, facet: true, optional: true },
    { name: 'type.value', type: 'string' as const, facet: true, optional: true },
    { name: 'collection.title', type: 'string' as const, facet: true, optional: true },
    { name: 'variants.title', type: 'string[]' as const, facet: true, optional: true },
    { name: 'variants.prices.amount', type: 'float[]' as const, facet: true, optional: true },
    { name: 'variants.prices.currency_code', type: 'string[]' as const, facet: true, optional: true },
    { name: 'seller.id', type: 'string' as const, facet: true, optional: true },
    { name: 'seller.handle', type: 'string' as const, facet: true, optional: true },
    { name: 'seller.name', type: 'string' as const, facet: true, optional: true },
    { name: 'seller.status', type: 'string' as const, facet: true, optional: true },
    { name: 'seller.country_code', type: 'string' as const, facet: true, optional: true },
    { name: 'seller.fulfillment_types', type: 'string[]' as const, facet: true, optional: true },
  ],
}

class TypesenseModuleService {
  private client_: Typesense.Client
  private host_: string
  private settingsApplied_ = false

  constructor(_: unknown, options: ModuleOptions) {
    if (!options?.host || !options?.apiKey) {
      const missing = [
        !options?.host && 'TYPESENSE_HOST',
        !options?.apiKey && 'TYPESENSE_API_KEY',
      ]
        .filter(Boolean)
        .join(', ')
      throw new Error(
        `[typesense module] Missing required environment variables: ${missing}`
      )
    }
    this.host_ = options.host
    this.client_ = new Typesense.Client({
      nodes: [
        {
          host: options.host,
          port: options.port || 8108,
          protocol: options.protocol || 'http',
        },
      ],
      apiKey: options.apiKey,
      connectionTimeoutSeconds: 2,
    })
  }

  getHost(): string {
    return this.host_
  }

  async getStatus(): Promise<{ documentCount: number; isHealthy: boolean }> {
    try {
      const health = await this.client_.health.retrieve()
      const stats = await this.client_.collections(IndexType.PRODUCT).retrieve()
      return {
        documentCount: stats.num_documents || 0,
        isHealthy: health.ok === true,
      }
    } catch {
      return { documentCount: 0, isHealthy: false }
    }
  }

  async batchUpsert(documents: TypesenseEntity[]): Promise<void> {
    if (!documents.length) {
      return
    }
    await this.ensureSettings()
    await this.client_
      .collections(IndexType.PRODUCT)
      .documents()
      .import(documents, { action: 'upsert' })
  }

  async batchDelete(ids: string[]): Promise<void> {
    if (!ids.length) {
      return
    }
    const collection = this.client_.collections(IndexType.PRODUCT).documents()
    await Promise.all(ids.map((id) => collection.delete(id).catch(() => {})))
  }

  async search(
    query: string,
    options: Record<string, unknown>
  ): Promise<TypesenseSearchResult> {
    await this.ensureSettings()
    const searchParams: Typesense.SearchParams = {
      q: query || '*',
      query_by: SEARCHABLE_ATTRIBUTES.join(','),
      filter_by: (options.filter_by as string) || '',
      sort_by: (options.sort_by as string) || '',
      page: ((options.page as number) || 1).toString(),
      per_page: ((options.hitsPerPage as number) || 20).toString(),
      facet_by: (options.facet_by as string) || '',
      max_facet_values: (options.max_facet_values as number)?.toString() || '50',
      highlight_full_fields: SEARCHABLE_ATTRIBUTES.join(','),
    }

    const result = await this.client_
      .collections(IndexType.PRODUCT)
      .documents()
      .search(searchParams)

    const facetDistribution: Record<string, Record<string, number>> = {}
    if (result.facet_counts) {
      for (const facet of result.facet_counts) {
        facetDistribution[facet.field_name] = {}
        for (const count of facet.counts) {
          facetDistribution[facet.field_name][count.value] = count.count
        }
      }
    }

    return {
      hits: (result.hits ?? []).map((hit) => ({ id: hit.document.id as string })),
      totalHits: result.found ?? 0,
      page: result.page ?? 1,
      totalPages: Math.ceil(
        (result.found ?? 0) / (result.request_params?.per_page ?? 20)
      ),
      hitsPerPage: result.request_params?.per_page ?? 20,
      processingTimeMs: result.search_time_ms ?? 0,
      query: result.request_params?.q ?? query,
      facetDistribution,
    }
  }

  async ensureSettings(): Promise<void> {
    if (this.settingsApplied_) {
      return
    }
    try {
      const collection = await this.client_.collections(IndexType.PRODUCT).retrieve()
      const existingFields = new Set(
        (collection as { fields?: Array<{ name?: string }> }).fields
          ?.map((field) => field.name)
          .filter(Boolean)
      )
      const missingFields = SCHEMA.fields.filter((field) => !existingFields.has(field.name))

      if (missingFields.length) {
        await this.client_
          .collections(IndexType.PRODUCT)
          .update({ fields: missingFields } as any)
      }
    } catch {
      await this.client_.collections().create(SCHEMA)
    }
    this.settingsApplied_ = true
  }
}

export default TypesenseModuleService
