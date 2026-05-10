import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import { AdminInviteSellerMemberType } from "../../../validators"
import { createMemberInvitesWorkflow } from "../../../../../../workflows/seller"
import { posthog } from "../../../../../../lib/posthog"

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminInviteSellerMemberType>,
  res: MedusaResponse
) => {
  const { result: invites } = await createMemberInvitesWorkflow(
    req.scope
  ).run({
    input: [
      {
        seller_id: req.params.id,
        email: req.validatedBody.email,
        role_id: req.validatedBody.role_id,
      },
    ],
  })

  posthog?.capture({
    distinctId: req.auth_context.actor_id ?? "admin",
    event: "seller_member_invited",
    properties: {
      seller_id: req.params.id,
      invite_email: req.validatedBody.email,
    },
  })

  res.status(201).json({ member_invite: invites[0] })
}
