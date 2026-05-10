import { PostHog } from "posthog-node"
import { loadEnv } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const apiKey = process.env.POSTHOG_API_KEY
const host = process.env.POSTHOG_HOST

if (!apiKey) {
  console.warn("[PostHog] POSTHOG_API_KEY not set — PostHog analytics disabled")
}

export const posthog = apiKey
  ? new PostHog(apiKey, {
      host,
      enableExceptionAutocapture: true,
    })
  : null

process.on("SIGINT", async () => {
  if (posthog) await posthog.shutdown()
})
process.on("SIGTERM", async () => {
  if (posthog) await posthog.shutdown()
})
