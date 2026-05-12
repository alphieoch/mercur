import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, Modules, QueryContext } from '@medusajs/framework/utils'

import { TYPESENSE_MODULE, TypesenseModuleService } from '../../../../modules/typesense'
import { StoreSearchType } from './validators'
import { posthog } from '../../../../lib/posthog'

function buildTypesenseFilter(filters?: StoreSearchType['filters']): string {
  const parts: string[] = ['seller.status:=open']

  if (filters?.categories?.length) {
    const ids = filters.categories.join(',')
    parts.push(`categories.id:=[${ids}]`)
  }
  if (filters?.price_min !== undefined) {
    parts.push(`variants.prices.amount:>=${filters.price_min}`)
  }
  if (filters?.price_max !== undefined) {
    parts.push(`variants.prices.amount:<=${filters.price_max}`)
  }
  if (filters?.seller_handle) {
    parts.push(`seller.handle:=${filters.seller_handle}`)
  }
  if (filters?.region_codes?.length) {
    const countryCodes = filters.region_codes.map((code) => code.toLowerCase()).join(',')
    parts.push(`seller.country_code:=[${countryCodes}]`)
  }
  if (filters?.fulfillment_types?.length) {
    const fulfillmentTypes = filters.fulfillment_types
      .map((type) => type.toLowerCase())
      .join(',')
    parts.push(`seller.fulfillment_types:=[${fulfillmentTypes}]`)
  }

  return parts.join(' && ')
}

function mapSortToTypesense(sort?: StoreSearchType['sort']): string {
  switch (sort) {
    case 'title_asc':
      return 'title:asc'
    case 'title_desc':
      return 'title:desc'
    case 'price_asc':
      return 'variants.prices.amount:asc'
    case 'price_desc':
      return 'variants.prices.amount:desc'
    case 'relevance':
    default:
      return ''
  }
}

export const POST = async (
  req: MedusaRequest<StoreSearchType>,
  res: MedusaResponse
) => {
  const typesenseService =
    req.scope.resolve<TypesenseModuleService>(TYPESENSE_MODULE)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    query: searchQuery,
    page,
    hitsPerPage,
    filters,
    currency_code: reqCurrencyCode,
    region_id,
    customer_id,
    customer_group_id,
    facets,
    maxValuesPerFacet,
    sort,
  } = req.validatedBody

  let currency_code = reqCurrencyCode
  if (!currency_code && region_id) {
    const regionService = req.scope.resolve(Modules.REGION)
    const region = await regionService.retrieveRegion(region_id)
    currency_code = region?.currency_code
  }

  const filter_by = buildTypesenseFilter(filters)
  const facet_by = facets?.join(',') || ''
  const sort_by = mapSortToTypesense(sort)

  const searchResult = await typesenseService.search(searchQuery, {
    filter_by,
    page,
    hitsPerPage,
    facet_by,
    max_facet_values: maxValuesPerFacet || 50,
    sort_by,
  })

  const productIds = searchResult.hits.map((hit) => hit.id)

  if (!productIds.length) {
    return res.json({
      products: [],
      nbHits: 0,
      page: searchResult.page,
      nbPages: 0,
      hitsPerPage: searchResult.hitsPerPage,
      processingTimeMS: searchResult.processingTimeMs,
      facets: searchResult.facetDistribution || {},
    })
  }

  const hasPricingContext =
    currency_code || region_id || customer_id || customer_group_id

  const contextParams: Record<string, unknown> = {}
  if (hasPricingContext) {
    contextParams.variants = {
      calculated_price: QueryContext({
        ...(currency_code && { currency_code }),
        ...(region_id && { region_id }),
        ...(customer_id && { customer_id }),
        ...(customer_group_id && { customer_group_id }),
      }),
    }
  }

  const { data: products } = await query.graph({
    entity: 'product',
    fields: [
      '*',
      'images.*',
      'options.*',
      'options.values.*',
      'variants.*',
      'variants.options.*',
      'variants.prices.*',
      ...(hasPricingContext ? ['variants.calculated_price.*'] : []),
      'categories.*',
      'collection.*',
      'type.*',
      'tags.*',
      'seller.*',
    ],
    filters: { id: productIds },
    ...(Object.keys(contextParams).length > 0 && { context: contextParams }),
  })

  const productMap = new Map(products.map((p) => [p.id, p]))
  const orderedProducts = productIds
    .map((id) => productMap.get(id))
    .filter(Boolean)

  const distinctId = req.headers["x-posthog-distinct-id"] as string | undefined
    ?? customer_id
    ?? "anonymous"

  posthog?.capture({
    distinctId,
    event: "product_search_performed",
    properties: {
      query: searchQuery,
      nb_hits: searchResult.totalHits,
      page: searchResult.page,
      filters: filters ?? null,
      $session_id: req.headers["x-posthog-session-id"] as string | undefined,
    },
  })

  return res.json({
    products: orderedProducts,
    nbHits: searchResult.totalHits,
    page: searchResult.page,
    nbPages: searchResult.totalPages,
    hitsPerPage: searchResult.hitsPerPage,
    processingTimeMS: searchResult.processingTimeMs,
    facets: searchResult.facetDistribution || {},
  })
}
