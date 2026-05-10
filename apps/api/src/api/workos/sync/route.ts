import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { workos, workosEnabled } from "../../../lib/workos"
import { workosSyncService } from "../../../modules/workos/services/workos-sync-service"

/**
 * POST /workos/sync
 *
 * Trigger a manual sync from WorkOS to Medusa/Mercur.
 * Query params:
 *   - scope: "organizations" | "users" | "memberships" | "all" (default: all)
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const scope = (req.query.scope as string) || "all"

  const results: any = {}

  if (scope === "all" || scope === "organizations") {
    results.organizations = await workosSyncService.syncAllOrganizations(req.scope)
  }

  if (scope === "all" || scope === "users") {
    results.users = await workosSyncService.syncAllUsers(req.scope)
  }

  if (scope === "all" || scope === "memberships") {
    results.memberships = await workosSyncService.syncAllMemberships(req.scope)
  }

  return res.status(200).json({
    message: "Sync completed",
    scope,
    results,
  })
}

/**
 * GET /workos/sync
 *
 * Check WorkOS connection status and basic stats.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {

  if (!workosEnabled || !workos) {
    return res.status(503).json({
      enabled: false,
      message: "WorkOS not configured — check WORKOS_API_KEY",
    })
  }

  try {
    const orgs = await workos.organizations.listOrganizations({ limit: 1 })
    const users = await workos.userManagement.listUsers({ limit: 1 })

    return res.status(200).json({
      enabled: true,
      client_id: process.env.WORKOS_CLIENT_ID,
      organizations_count: orgs.data.length,
      users_count: users.data.length,
    })
  } catch (err: any) {
    return res.status(500).json({
      enabled: true,
      error: err.message,
    })
  }
}
