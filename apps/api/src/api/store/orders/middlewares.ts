import {
  validateAndTransformBody,
} from "@medusajs/framework";
import { authenticate, MiddlewareRoute } from "@medusajs/medusa";

import { StoreConfirmOrderReceipt } from "./validators";

export const storeOrderMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/orders/:id/confirm-receipt",
    middlewares: [
      authenticate("customer", ["bearer", "session"]),
      validateAndTransformBody(StoreConfirmOrderReceipt),
    ],
  },
];
