import { MedusaRequest, MedusaResponse } from '@medusajs/framework'
import { ContainerRegistrationKeys, Modules, QueryContext } from '@medusajs/framework/utils'

import { TYPESENSE_MODULE, TypesenseModuleService } from '../../../../modules/typesense'
import { StoreSearchType } from './validators'

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

  return parts.join(' && ')
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
  } = req.validatedBody

  let currency_code = reqCurrencyCode
  if (!currency_code && region_id) {
    const regionService = req.scope.resolve(Modules.REGION)
    const region = await regionService.retrieveRegion(region_id)
    currency_code = region?.currency_code
  }

  const filter_by = buildTypesenseFilter(filters)
  const facet_by = facets?.join(',') || ''

  const searchResult = await typesenseService.search(searchQuery, {
    filter_by,
    page,
    hitsPerPage,
    facet_by,
    max_facet_values: maxValuesPerFacet || 50,
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
