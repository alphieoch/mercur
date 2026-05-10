import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import customerReview from "../../../links/customer-review";
import { StoreReviewListResponse, StoreReviewResponse } from "../../../modules/reviews/types";
import { createReviewWorkflow } from "../../../workflows/review/workflows";
import { StoreCreateReviewType, StoreGetReviewsParamsType } from "./validators";
import { posthog } from "../../../lib/posthog";

export const POST = async (
  req: AuthenticatedMedusaRequest<StoreCreateReviewType>,
  res: MedusaResponse<StoreReviewResponse>
) => {
  const { result } = await createReviewWorkflow.run({
    container: req.scope,
    input: {
      ...req.validatedBody,
      customer_id: req.auth_context.actor_id,
    },
  });

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const {
    data: [review],
  } = await query.graph({
    entity: "review",
    fields: req.queryConfig.fields,
    filters: {
      id: result.id,
    },
  });

  const distinctId = req.headers["x-posthog-distinct-id"] as string | undefined
    ?? req.auth_context.actor_id

  posthog?.capture({
    distinctId,
    event: "review_created",
    properties: {
      review_id: result.id,
      customer_id: req.auth_context.actor_id,
      rating: req.validatedBody.rating,
      $session_id: req.headers["x-posthog-session-id"] as string | undefined,
    },
  })

  res.status(201).json({ review });
};

export const GET = async (
  req: AuthenticatedMedusaRequest<StoreGetReviewsParamsType>,
  res: MedusaResponse<StoreReviewListResponse>
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: reviews, metadata } = await query.graph({
    entity: customerReview.entryPoint,
    fields: req.queryConfig.fields.map((field) => `review.${field}`),
    filters: {
      customer_id: req.auth_context.actor_id,
    },
    pagination: req.queryConfig.pagination,
  });

  res.json({
    reviews: reviews.map((relation) => relation.review),
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 0,
  });
};
