import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

import { TYPESENSE_MODULE, TypesenseModuleService } from '../modules/typesense'
import { TypesenseEvents } from '../modules/typesense/types'
import {
  filterProductsByStatus,
  findAndTransformTypesenseProducts,
} from './utils/typesense-product'

export default async function typesenseProductsChangedHandler({
  event,
  container,
}: SubscriberArgs<{ ids: string[] }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    const typesense =
      container.resolve<TypesenseModuleService>(TYPESENSE_MODULE)

    const { published, other } = await filterProductsByStatus(
      container,
      event.data.ids
    )

    logger.debug(
      `Typesense sync: Processing ${event.data.ids.length} products — ${published.length} to upsert, ${other.length} to delete`
    )

    const [documentsToUpsert] = await Promise.all([
      published.length
        ? findAndTransformTypesenseProducts(container, published)
        : Promise.resolve([]),
      other.length
        ? typesense.batchDelete(other)
        : Promise.resolve(),
    ])

    if (documentsToUpsert.length) {
      await typesense.batchUpsert(documentsToUpsert)
    }

    logger.debug(
      `Typesense sync: Successfully synced ${documentsToUpsert.length} products`
    )
  } catch (error: unknown) {
    logger.error(
      `Typesense sync failed for products [${event.data.ids.join(', ')}]:`,
      error as Error
    )
    throw error
  }
}

export const config: SubscriberConfig = {
  event: TypesenseEvents.PRODUCTS_CHANGED,
  context: {
    subscriberId: 'typesense-products-changed-handler',
  },
}
