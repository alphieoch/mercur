import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { workos, workosEnabled } from "../../../lib/workos"
import { workosSyncService } from "../../../modules/workos/services/workos-sync-service"

/**
 * GET /workos/auth/callback
 *
 * WorkOS AuthKit OAuth callback.
 * After user authenticates with WorkOS, they are redirected here with a `code`.
 * We exchange the code for tokens, sync the user to Medusa, and create a session.
 *
 * Query params:
 *   - code: Authorization code from WorkOS
 *   - state: Optional state parameter
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!workosEnabled || !workos) {
    return res.status(503).json({ message: "WorkOS not configured" })
  }

  const code = req.query.code as string
  const state = req.query.state as string | undefined

  if (!code) {
    return res.status(400).json({ message: "Missing authorization code" })
  }

  try {
    // Exchange code for tokens and user info
    const { user, accessToken, refreshToken } = await workos.userManagement.authenticateWithCode({
      clientId: process.env.WORKOS_CLIENT_ID!,
      code,
    })

    // Sync user to Medusa as a customer
    const { customerId } = await workosSyncService.syncUserAsCustomer(user, req.scope)

    // Get or create auth identity for the customer
    const authModule = req.scope.resolve("auth")
    const customerModule = req.scope.resolve("customer")

    // Find existing auth identity or create one
    const { data: existingIdentities } = await authModule.listAuthIdentities({
      provider_identities: { provider: "emailpass", entity_id: user.email },
    })

    let authIdentity = existingIdentities[0]

    if (!authIdentity) {
      // Create a new auth identity linked to the customer
      authIdentity = await authModule.createAuthIdentities({
        provider_identities: [{
          provider: "emailpass",
          entity_id: user.email,
        }],
      })
    }

    // Generate Medusa JWT token
    const jwtSecret = process.env.JWT_SECRET || "supersecret"
    const jwt = await import("jsonwebtoken")
    const token = jwt.sign(
      {
        actor_id: customerId,
        actor_type: "customer",
        auth_identity_id: authIdentity.id,
        app_metadata: {},
        user_metadata: {},
      },
      jwtSecret,
      { expiresIn: "24h" }
    )

    // Redirect to storefront with token (state may be full locale callback URL)
    const redirectUrl =
      state || process.env.STORE_CORS?.split(",")[0] || "http://localhost:3000"
    const redirectWithToken =
      typeof redirectUrl === "string" &&
      redirectUrl.includes("workos/callback")
        ? new URL(redirectUrl)
        : new URL("/workos/callback", redirectUrl)
    redirectWithToken.searchParams.set("token", token)
    redirectWithToken.searchParams.set("customer_id", customerId)

    return res.redirect(302, redirectWithToken.toString())
  } catch (err: any) {
    console.error("[WorkOS Auth] Error:", err)
    return res.status(500).json({ message: err.message || "Authentication failed" })
  }
}

/**
 * POST /workos/auth
 *
 * Initiate WorkOS AuthKit login.
 * Returns the authorization URL to redirect the user to.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!workosEnabled || !workos) {
    return res.status(503).json({ message: "WorkOS not configured" })
  }

  try {
    const { redirectUri, state, organizationId } = req.body as {
      redirectUri?: string
      state?: string
      organizationId?: string
    }

    const authorizationUrl = workos.userManagement.getAuthorizationUrl({
      provider: "authkit",
      clientId: process.env.WORKOS_CLIENT_ID!,
      redirectUri: redirectUri || `${req.protocol}://${req.get("host")}/workos/auth`,
      state: state || "default",
      ...(organizationId ? { organizationId } : {}),
    })

    return res.status(200).json({ authorizationUrl })
  } catch (err: any) {
    console.error("[WorkOS Auth] Error:", err)
    return res.status(500).json({ message: err.message })
  }
}
