import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { workos, workosEnabled } from "../../../lib/workos"
import { workosSyncService } from "../../../modules/workos/services/workos-sync-service"

/**
 * WorkOS Webhook Handler
 *
 * Receives real-time events from WorkOS and syncs to Medusa/Mercur.
 *
 * Events handled:
 * - organization.created → create/update Seller
 * - organization.updated → update Seller
 * - organization.deleted → suspend Seller
 * - user.created → create Customer
 * - user.updated → update Customer
 * - user.deleted → soft-delete Customer
 * - organization_membership.added → create SellerMember link
 * - organization_membership.updated → update SellerMember link/role
 * - organization_membership.removed → remove SellerMember link
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!workosEnabled || !workos) {
    return res.status(503).json({ message: "WorkOS not configured" })
  }

  const sig = req.headers["workos-signature"] as string
  const body = JSON.stringify(req.body)
  const secret = process.env.WORKOS_WEBHOOK_SECRET

  let event
  try {
    if (secret && sig) {
      event = workos.webhooks.constructEvent({ payload: body as unknown as Record<string, unknown>, sigHeader: sig, secret })
    } else {
      // Fallback if no webhook secret configured (dev mode)
      event = req.body as any
    }
  } catch (err: any) {
    console.error("[WorkOS Webhook] Signature verification failed:", err.message)
    return res.status(400).json({ message: "Invalid signature" })
  }

  console.log(`[WorkOS Webhook] ${event.event} received`)

  try {
    switch (event.event) {
      case "organization.created":
      case "organization.updated": {
        await workosSyncService.syncOrganization(event.data, req.scope)
        break
      }
      case "organization.deleted": {
        const sellerService = req.scope.resolve("seller" as any)
        const query = req.scope.resolve("query")
        const { data: sellers } = await query.graph({
          entity: "seller",
          fields: ["id"],
          filters: { metadata: { workos_org_id: event.data.id } } as any,
        })
        if (sellers[0]) {
          await sellerService.updateSellers(sellers[0].id, { status: "terminated" })
        }
        break
      }
      case "user.created":
      case "user.updated": {
        await workosSyncService.syncUserAsCustomer(event.data, req.scope)
        break
      }
      case "user.deleted": {
        const customerModule = req.scope.resolve("customer")
        const query = req.scope.resolve("query")
        const { data: customers } = await query.graph({
          entity: "customer",
          fields: ["id"],
          filters: { metadata: { workos_user_id: event.data.id } } as any,
        })
        if (customers[0]) {
          await customerModule.deleteCustomers([customers[0].id])
        }
        break
      }
      case "organization_membership.added":
      case "organization_membership.updated": {
        await workosSyncService.syncOrganizationMembership(event.data, req.scope)
        break
      }
      case "organization_membership.removed": {
        const sellerService = req.scope.resolve("seller" as any)
        const query = req.scope.resolve("query")
        const { data: links } = await query.graph({
          entity: "seller_member",
          fields: ["id"],
          filters: { metadata: { workos_membership_id: event.data.id } } as any,
        })
        if (links[0]) {
          await sellerService.deleteSellerMembers([links[0].id])
        }
        break
      }
      default: {
        console.log(`[WorkOS Webhook] Unhandled event: ${event.event}`)
      }
    }

    return res.status(200).json({ received: true })
  } catch (err: any) {
    console.error(`[WorkOS Webhook] Error handling ${event.event}:`, err)
    return res.status(500).json({ message: err.message })
  }
}
