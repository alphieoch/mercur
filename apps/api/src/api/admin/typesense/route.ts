import { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework'

import { TYPESENSE_MODULE, TypesenseModuleService } from '../../../modules/typesense'
import { IndexType } from '../../../modules/typesense/types'
import { syncTypesenseWorkflow } from '../../../workflows/typesense/workflows/sync-typesense'

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  await syncTypesenseWorkflow.run({
    container: req.scope,
  })

  res.status(200).json({ message: 'Sync in progress' })
}

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const typesense =
    req.scope.resolve<TypesenseModuleService>(TYPESENSE_MODULE)

  const host = typesense.getHost()
  const { documentCount, isHealthy } = await typesense.getStatus()

  res.status(200).json({
    host,
    index: IndexType.PRODUCT,
    documentCount,
    isHealthy,
  })
}
