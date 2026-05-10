import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

export const validateSellerProduct = async (
  scope: MedusaContainer,
  sellerId: string,
  productId: string
) => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [sellerProduct],
  } = await query.graph({
    entity: "product_seller",
    filters: {
      seller_id: sellerId,
      product_id: productId,
    },
    fields: ["seller_id", "product_id"],
  })

  if (!sellerProduct) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Product with id: ${productId} was not found`
    )
  }
}

export const assertSellerComplianceReadyForListing = async (
  scope: MedusaContainer,
  sellerId: string
) => {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [seller],
  } = await query.graph({
    entity: "seller",
    fields: [
      "id",
      "status",
      "professional_details.id",
      "professional_details.county",
      "professional_details.national_id_number",
      "professional_details.ownership_attestation",
      "professional_details.animal_health_attestation",
    ],
    filters: {
      id: sellerId,
    },
  })

  if (!seller) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Seller with id: ${sellerId} was not found`
    )
  }

  const details = seller.professional_details
  const isCompliant = Boolean(
    details?.county &&
      details?.national_id_number &&
      details?.ownership_attestation &&
      details?.animal_health_attestation
  )

  if (seller.status !== "open" || !isCompliant) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Seller compliance is incomplete. Provide county, national ID, ownership and animal-health attestations, then complete admin approval before listing products."
    )
  }
}
