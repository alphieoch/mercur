import { WorkOS } from "@workos-inc/node"
import { loadEnv } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const apiKey = process.env.WORKOS_API_KEY
const clientId = process.env.WORKOS_CLIENT_ID

if (!apiKey) {
  console.warn("[WorkOS] WORKOS_API_KEY not set — WorkOS features disabled")
}

export const workos = apiKey ? new WorkOS(apiKey, { clientId }) : null
export const workosEnabled = !!workos
