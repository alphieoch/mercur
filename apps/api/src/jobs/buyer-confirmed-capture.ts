import { MedusaContainer } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
} from "@medusajs/framework/utils";
import { cancelOrderWorkflow, capturePaymentWorkflow } from "@medusajs/medusa/core-flows";

const ELIGIBLE_FULFILLMENT_STATUSES = new Set([
  "fulfilled",
  "shipped",
  "partially_delivered",
  "delivered",
]);

// Keep default under common card-authorization windows (~7 days).
const BUYER_RELEASE_TIMEOUT_MS =
  Number(process.env.BUYER_RELEASE_TIMEOUT_MS || 5 * 24 * 60 * 60 * 1000);

export default async function buyerConfirmedCaptureJob(
  container: MedusaContainer
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "created_at",
      "fulfillment_status",
      "metadata",
      "payment_collections.id",
      "payment_collections.payments.id",
      "payment_collections.payments.captured_at",
    ],
    pagination: {
      take: 200,
      skip: 0,
    },
  });

  const now = Date.now();

  for (const order of orders as any[]) {
    if (!ELIGIBLE_FULFILLMENT_STATUSES.has(order.fulfillment_status)) {
      continue;
    }

    const payments = (order.payment_collections ?? []).flatMap(
      (collection: any) => collection.payments ?? []
    );

    const uncapturedPayments = payments.filter((payment: any) => !payment?.captured_at);

    if (!uncapturedPayments.length) {
      continue;
    }

    const buyerReleasedAt = order.metadata?.buyer_released_at;

    if (buyerReleasedAt) {
      for (const payment of uncapturedPayments) {
        await capturePaymentWorkflow(container).run({
          input: {
            payment_id: payment.id,
            captured_by: "system:buyer-confirmed-capture",
          },
        });
      }

      continue;
    }

    const elapsedMs = now - new Date(order.created_at).getTime();

    if (elapsedMs >= BUYER_RELEASE_TIMEOUT_MS) {
      await cancelOrderWorkflow(container).run({
        input: {
          order_id: order.id,
          canceled_by: "system:buyer-release-timeout",
        },
      });
    }
  }
}

export const config = {
  name: "buyer-confirmed-capture",
  schedule: "*/15 * * * *",
};
