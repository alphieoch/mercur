import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { posthog } from "../../../lib/posthog"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const event = {
      data: req.body, rawData: req.rawBody, headers: req.headers
    }

    const eventBus = req.scope.resolve(Modules.EVENT_BUS)

    await eventBus.emit(
      {
        name: "payout.webhook_received",
        data: event,
      },
      {
        delay: 5000,
        attempts: 3,
      }
    )
  } catch (err: any) {
    posthog?.captureException(err, "payout-webhook")
    res.status(400).send(`Webhook Error: ${err.message}`)
    return
  }

  posthog?.capture({
    distinctId: "payout-webhook",
    event: "payout_webhook_received",
  })

  res.sendStatus(200)
}
