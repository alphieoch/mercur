import { SubscriberArgs, SubscriberConfig } from '@medusajs/framework'

import { reindexSellerProducts } from './utils/typesense-product'

export default async function typesenseSellerUnsuspendedHandler({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  await reindexSellerProducts(container, event.data.id, 'unsuspended')
}

export const config: SubscriberConfig = {
  event: 'seller.unsuspended',
  context: {
    subscriberId: 'typesense-seller-unsuspended-handler',
  },
}
