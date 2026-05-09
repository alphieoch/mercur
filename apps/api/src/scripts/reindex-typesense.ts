import type { ExecArgs } from '@medusajs/framework/types'
import { ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { TYPESENSE_MODULE, TypesenseModuleService } from '../modules/typesense'
import {
  findAndTransformTypesenseProducts,
  filterProductsByStatus,
} from '../subscribers/utils/typesense-product'

export default async function reindexTypesense({ container }: ExecArgs) {
  const typesense = container.resolve<TypesenseModuleService>(TYPESENSE_MODULE)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  
  const { data: products } = await query.graph({
    entity: 'product',
    fields: ['id'],
    filters: { status: 'published' },
  })
  
  const ids = products.map((p: any) => p.id)
  console.log(`Found ${ids.length} published products`)
  
  if (ids.length === 0) return
  
  await typesense.ensureSettings()
  
  const { published } = await filterProductsByStatus(container, ids)
  console.log(`Upserting ${published.length} products`)
  
  const BATCH = 50
  for (let i = 0; i < published.length; i += BATCH) {
    const batch = published.slice(i, i + BATCH)
    const docs = await findAndTransformTypesenseProducts(container, batch)
    await typesense.batchUpsert(docs)
    console.log(`Upserted batch ${Math.floor(i/BATCH) + 1}/${Math.ceil(published.length/BATCH)}`)
  }
  
  console.log('Reindex complete!')
}
