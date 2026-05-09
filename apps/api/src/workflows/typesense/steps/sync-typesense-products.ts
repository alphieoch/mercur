import { IEventBusModuleService, RemoteQueryFunction } from '@medusajs/framework/types'
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { StepResponse, createStep } from '@medusajs/framework/workflows-sdk'

import { TYPESENSE_MODULE, TypesenseModuleService } from '../../../modules/typesense'
import { TypesenseEvents } from '../../../modules/typesense/types'
import { chunkArray } from '../../../subscribers/utils/typesense-product'

export const syncTypesenseProductsStep = createStep(
  'sync-typesense-products',
  async (_: void, { container }) => {
    const query = container.resolve<RemoteQueryFunction>(
      ContainerRegistrationKeys.QUERY
    )
    const typesense =
      container.resolve<TypesenseModuleService>(TYPESENSE_MODULE)
    const eventBus = container.resolve<IEventBusModuleService>(Modules.EVENT_BUS)

    await typesense.ensureSettings()

    const { data: allProducts } = await query.graph({
      entity: 'product',
      fields: ['id', 'status'],
    })

    const toDelete: string[] = []
    const toIndex: string[] = []

    for (const product of allProducts) {
      if (product.status === 'published') {
        toIndex.push(product.id)
      } else {
        toDelete.push(product.id)
      }
    }

    if (toDelete.length) {
      await typesense.batchDelete(toDelete)
    }

    const chunks = chunkArray(toIndex, 100)
    await Promise.all(
      chunks.map((chunk) =>
        eventBus.emit({
          name: TypesenseEvents.PRODUCTS_CHANGED,
          data: { ids: chunk },
        })
      )
    )

    return new StepResponse()
  }
)
