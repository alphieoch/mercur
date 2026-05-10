import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { capturePaymentWorkflow, updateOrderWorkflow } from "@medusajs/medusa/core-flows";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";

import { StoreConfirmOrderReceiptType } from "../../validators";

const ELIGIBLE_FULFILLMENT_STATUSES = new Set([
  "fulfilled",
  "shipped",
  "partially_delivered",
  "delivered",
]);

export const POST = async (
  req: AuthenticatedMedusaRequest<StoreConfirmOrderReceiptType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const customerId = req.auth_context.actor_id;
  const orderId = req.params.id;

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "customer_id",
      "fulfillment_status",
      "metadata",
      "payment_collections.id",
      "payment_collections.payments.id",
      "payment_collections.payments.captured_at",
    ],
    filters: {
      id: orderId,
      customer_id: customerId,
    },
  });
  const orderData = order as any;

  if (!orderData) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Order with id: ${orderId} was not found`
    );
  }

  if (!ELIGIBLE_FULFILLMENT_STATUSES.has(orderData.fulfillment_status)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Order cannot be released yet. Confirm receipt after fulfillment or delivery."
    );
  }

  const metadata = orderData.metadata ?? {};
  const releaseMetadata = {
    ...metadata,
    buyer_released_at: metadata.buyer_released_at ?? new Date().toISOString(),
    buyer_release_ip: req.ip ?? null,
    buyer_release_notes: req.validatedBody.handover_notes ?? null,
  };

  await updateOrderWorkflow(req.scope).run({
    input: {
      id: orderData.id,
      user_id: customerId,
      metadata: releaseMetadata,
    },
  });

  const payments = (orderData.payment_collections ?? []).flatMap((collection: any) =>
    collection.payments ?? []
  );

  for (const payment of payments) {
    if (payment?.captured_at) {
      continue;
    }

    await capturePaymentWorkflow(req.scope).run({
      input: {
        payment_id: payment.id,
        captured_by: customerId,
      },
    });
  }

  const {
    data: [updatedOrder],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "fulfillment_status",
      "metadata",
      "payment_collections.id",
      "payment_collections.status",
      "payment_collections.amount",
      "payment_collections.captured_amount",
    ],
    filters: { id: orderData.id },
  });

  res.status(200).json({ order: updatedOrder });
};
