import { MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework'

import { StoreSearchSchema } from './validators'

export const storeSearchMiddlewares: MiddlewareRoute[] = [
  {
    methods: ['POST'],
    matcher: '/store/products/search',
    middlewares: [validateAndTransformBody(StoreSearchSchema)],
  },
]
