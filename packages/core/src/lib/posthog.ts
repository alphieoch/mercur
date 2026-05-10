import { PostHog } from "posthog-node"

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
