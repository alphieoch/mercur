import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'

import { TYPESENSE_MODULE, TypesenseModuleService } from '../modules/typesense'
import { TypesenseEvents } from '../modules/typesense/types'

export default async function typesenseProductsDeletedHandler({
  event,
  container,
}: SubscriberArgs<{ ids: string[] }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  try {
    const typesense =
      container.resolve<TypesenseModuleService>(TYPESENSE_MODULE)

    logger.debug(
      `Typesense delete: Removing ${event.data.ids.length} products from index`
    )

    await typesense.batchDelete(event.data.ids)

    logger.debug(
      `Typesense delete: Successfully removed ${event.data.ids.length} products`
    )
  } catch (error: unknown) {
    logger.error(
      `Typesense delete failed for products [${event.data.ids.join(', ')}]:`,
      error as Error
    )
    throw error
  }
}

export const config: SubscriberConfig = {
  event: TypesenseEvents.PRODUCTS_DELETED,
  context: {
    subscriberId: 'typesense-products-deleted-handler',
  },
}
