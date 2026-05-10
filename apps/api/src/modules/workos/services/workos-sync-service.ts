import { workos, workosEnabled } from "../../../lib/workos"
import { MedusaError } from "@medusajs/framework/utils"
import { Modules } from "@medusajs/framework/utils"
import type {
  Organization,
  User,
  OrganizationMembership,
} from "@workos-inc/node"

/**
 * WorkOS Sync Service
 *
 * Maps WorkOS entities to Medusa/Mercur entities:
 * - WorkOS Organization → Mercur Seller
 * - WorkOS User → Medusa Customer (buyer) or Mercur Member (vendor)
 * - WorkOS OrganizationMembership → SellerMember link + role
 */
export class WorkosSyncService {
  async syncOrganization(
    org: Organization,
    container: any
  ): Promise<{ sellerId: string; isNew: boolean }> {
    const sellerService = container.resolve("seller" as any)
    const query = container.resolve("query")

    // Try to find existing seller by WorkOS org ID in metadata
    // Query all sellers and filter in JS since metadata JSONB filters are unreliable
    const { data: allSellers } = await query.graph({
      entity: "seller",
      fields: ["id", "name", "handle", "email", "status", "metadata"],
    })
    const existing = allSellers.filter((s: any) => s.metadata?.workos_org_id === org.id)

    const sellerData: any = {
      name: org.name,
      handle: org.id.replace(/_/g, "-").toLowerCase(),
      email: org.name.replace(/\s+/g, "").toLowerCase() + "@workos.local",
      currency_code: "usd",
      status: "open",
      metadata: { workos_org_id: org.id, source: "workos" },
    }

    if (existing.length > 0) {
      const sellers = await sellerService.updateSellers([{ id: existing[0].id, ...sellerData }])
      return { sellerId: sellers[0].id, isNew: false }
    }

    const seller = await sellerService.createSellers([sellerData])
    return { sellerId: seller[0].id, isNew: true }
  }

  async syncUserAsCustomer(
    user: User,
    container: any
  ): Promise<{ customerId: string; isNew: boolean }> {
    const customerModule = container.resolve(Modules.CUSTOMER)
    const query = container.resolve("query")

    // Find existing customer by email
    const { data: allCustomers } = await query.graph({
      entity: "customer",
      fields: ["id", "email", "first_name", "last_name", "metadata"],
    })
    const existing = allCustomers.filter((c: any) => c.email === user.email)

    const customerData: any = {
      email: user.email,
      first_name: user.firstName || "",
      last_name: user.lastName || "",
      metadata: { workos_user_id: user.id, source: "workos" },
    }

    if (existing.length > 0) {
      const customer = await customerModule.updateCustomers(existing[0].id, customerData)
      return { customerId: customer.id, isNew: false }
    }

    const customer = await customerModule.createCustomers(customerData)
    return { customerId: customer.id, isNew: true }
  }

  async syncUserAsMember(
    user: User,
    container: any
  ): Promise<{ memberId: string; isNew: boolean }> {
    const sellerService = container.resolve("seller" as any)
    const query = container.resolve("query")

    // Find existing member by email
    const { data: existing } = await query.graph({
      entity: "member",
      fields: ["id", "email", "first_name", "last_name", "metadata"],
      filters: { email: user.email },
    })

    const memberData: any = {
      email: user.email,
      first_name: user.firstName || "",
      last_name: user.lastName || "",
      metadata: { workos_user_id: user.id, source: "workos" },
    }

    if (existing.length > 0) {
      const members = await sellerService.updateMembers([{ id: existing[0].id, ...memberData }])
      return { memberId: members[0].id, isNew: false }
    }

    const member = await sellerService.createMembers([memberData])
    return { memberId: member[0].id, isNew: true }
  }

  async syncOrganizationMembership(
    membership: OrganizationMembership,
    container: any
  ): Promise<{ sellerMemberId: string; isNew: boolean }> {
    const sellerService = container.resolve("seller" as any)
    const query = container.resolve("query")

    // Find seller by WorkOS org ID
    const { data: allSellers } = await query.graph({
      entity: "seller",
      fields: ["id", "metadata"],
    })
    const sellers = allSellers.filter((s: any) => s.metadata?.workos_org_id === membership.organizationId)
    if (sellers.length === 0) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Seller for WorkOS org ${membership.organizationId} not found`
      )
    }
    const seller = sellers[0]

    // Find member by WorkOS user ID
    const { data: allMembers } = await query.graph({
      entity: "member",
      fields: ["id", "metadata"],
    })
    const members = allMembers.filter((m: any) => m.metadata?.workos_user_id === membership.userId)
    if (members.length === 0) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Member for WorkOS user ${membership.userId} not found`
      )
    }
    const member = members[0]

    // Check for existing seller-member link
    const { data: allLinks } = await query.graph({
      entity: "seller_member",
      fields: ["id", "seller_id", "member_id", "role_id", "metadata"],
    })
    const existing = allLinks.filter((l: any) => l.seller_id === seller.id && l.member_id === member.id)

    const roleId = membership.role?.slug || "role_seller_administration"
    const linkData: any = {
      seller_id: seller.id,
      member_id: member.id,
      role_id: roleId,
      metadata: {
        workos_membership_id: membership.id,
        workos_role: membership.role?.slug,
        source: "workos",
      },
    }

    if (existing.length > 0) {
      const links = await sellerService.updateSellerMembers([{ id: existing[0].id, ...linkData }])
      return { sellerMemberId: links[0].id, isNew: false }
    }

    const link = await sellerService.createSellerMembers([linkData])
    return { sellerMemberId: link[0].id, isNew: true }
  }

  /** Pull all organizations from WorkOS and sync */
  async syncAllOrganizations(container: any): Promise<{
    created: number
    updated: number
    errors: string[]
  }> {
    if (!workosEnabled || !workos) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "WorkOS is not configured"
      )
    }

    let created = 0
    let updated = 0
    const errors: string[] = []

    const orgs = await workos.organizations.listOrganizations({ limit: 100 })
    for (const org of orgs.data) {
      try {
        const { isNew } = await this.syncOrganization(org, container)
        if (isNew) created++
        else updated++
      } catch (err: any) {
        errors.push(`Org ${org.id}: ${err.message}`)
      }
    }

    return { created, updated, errors }
  }

  /** Pull all users from WorkOS and sync as customers */
  async syncAllUsers(container: any): Promise<{
    created: number
    updated: number
    errors: string[]
  }> {
    if (!workosEnabled || !workos) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "WorkOS is not configured"
      )
    }

    let created = 0
    let updated = 0
    const errors: string[] = []

    const users = await workos.userManagement.listUsers({ limit: 100 })
    for (const user of users.data) {
      try {
        const { isNew } = await this.syncUserAsCustomer(user, container)
        if (isNew) created++
        else updated++
      } catch (err: any) {
        errors.push(`User ${user.id}: ${err.message}`)
      }
    }

    return { created, updated, errors }
  }

  /** Pull all memberships and sync */
  async syncAllMemberships(container: any): Promise<{
    created: number
    updated: number
    errors: string[]
  }> {
    if (!workosEnabled || !workos) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "WorkOS is not configured"
      )
    }

    let created = 0
    let updated = 0
    const errors: string[] = []

    const orgs = await workos.organizations.listOrganizations({ limit: 100 })
    for (const org of orgs.data) {
      try {
        const memberships = await workos.userManagement.listOrganizationMemberships({
          organizationId: org.id,
          limit: 100,
        })
        for (const membership of memberships.data) {
          try {
            const { isNew } = await this.syncOrganizationMembership(membership, container)
            if (isNew) created++
            else updated++
          } catch (err: any) {
            errors.push(`Membership ${membership.id}: ${err.message}`)
          }
        }
      } catch (err: any) {
        errors.push(`Org ${org.id} memberships: ${err.message}`)
      }
    }

    return { created, updated, errors }
  }
}

export const workosSyncService = new WorkosSyncService()
