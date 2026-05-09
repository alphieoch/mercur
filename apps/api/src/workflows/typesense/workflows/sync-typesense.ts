import { createWorkflow, WorkflowResponse } from '@medusajs/framework/workflows-sdk'

import { syncTypesenseProductsStep } from '../steps/sync-typesense-products'

export const syncTypesenseWorkflow = createWorkflow(
  'sync-typesense-workflow',
  function () {
    return new WorkflowResponse(syncTypesenseProductsStep())
  }
)
