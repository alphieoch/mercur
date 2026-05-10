import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { HttpTypes } from "@mercurjs/types"

import { createPayoutAccountWorkflow } from "../../../workflows/payout"
import { VendorCreatePayoutAccountType } from "./validators"

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse<HttpTypes.VendorPayoutAccountListResponse>
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: payout_accounts, metadata } = await query.graph({
    entity: "payout_account",
    fields: req.queryConfig.fields,
    filters: req.filterableFields,
    pagination: req.queryConfig.pagination,
  })

  res.json({
    payout_accounts,
    count: metadata?.count ?? 0,
    offset: metadata?.skip ?? 0,
    limit: metadata?.take ?? 0,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<VendorCreatePayoutAccountType>,
  res: MedusaResponse<HttpTypes.VendorPayoutAccountResponse>
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const sellerId = req.seller_context!.seller_id

  const {
    data: [seller],
  } = await query.graph({
    entity: "seller",
    fields: ["id", "currency_code", "payment_details.country_code"],
    filters: { id: sellerId },
  })

  if (!seller) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Seller with id: ${sellerId} was not found`
    )
  }

  const sellerCurrency = String(seller.currency_code || "").toLowerCase()
  const payoutCountry = String(seller.payment_details?.country_code || "").toLowerCase()

  if (payoutCountry !== "ke" || sellerCurrency !== "kes") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Kenya escrow-style payouts require seller payout country 'KE' and seller currency 'KES'. Update payment details and currency before creating a payout account."
    )
  }

  const { result } = await createPayoutAccountWorkflow(req.scope).run({
    input: {
      seller_id: sellerId,
      data: req.validatedBody.data,
      context: req.validatedBody.context,
    },
  })

  const {
    data: [payout_account],
  } = await query.graph({
    entity: "payout_account",
    fields: req.queryConfig.fields,
    filters: { id: result.id },
  })

  res.status(201).json({ payout_account })
}
