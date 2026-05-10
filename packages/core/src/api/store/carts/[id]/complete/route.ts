import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { HttpTypes } from "@mercurjs/types"

import { completeCartWithSplitOrdersWorkflow } from "../../../../../workflows/cart"
import { defaultStoreCartFields, refetchCart } from "../../helpers"
import { StoreCompleteCartParamsType } from "./validators"
import { posthog } from "../../../../../lib/posthog"

export const POST = async (
    req: MedusaRequest<{}, StoreCompleteCartParamsType>,
    res: MedusaResponse<HttpTypes.StoreCompleteCartResponse>
) => {
    const cart_id = req.params.id

    const { errors, result } = await completeCartWithSplitOrdersWorkflow(req.scope).run({
        input: { cart_id },
        throwOnError: false,
    })

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // When an error occurs on the workflow, it's potentially to do with cart validations, payments
    // or inventory checks. Return the cart here along with errors for the consumer to take more action
    // and fix them
    if (errors?.[0]) {
        const error = errors[0].error
        const statusOKErrors: string[] = [
            MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR,
            MedusaError.Types.PAYMENT_REQUIRES_MORE_ERROR,
        ]

        const cart = await refetchCart(
            cart_id,
            req.scope,
            defaultStoreCartFields
        )

        if (!statusOKErrors.includes(error?.type)) {
            throw error
        }

        res.status(200).json({
            type: "cart",
            cart,
            error: {
                message: error.message,
                name: error.name,
                type: error.type,
            },
        })
        return
    }

    // Fetch the order group with orders
    const { data: orderGroups } = await query.graph({
        entity: "order_group",
        fields: req.queryConfig.fields,
        filters: { id: result.order_group_id },
    })

    const distinctId = req.headers["x-posthog-distinct-id"] as string | undefined
        ?? "anonymous"

    posthog?.capture({
        distinctId,
        event: "checkout_completed",
        properties: {
            cart_id,
            order_group_id: result.order_group_id,
            $session_id: req.headers["x-posthog-session-id"] as string | undefined,
        },
    })

    res.status(200).json({
        type: "order_group",
        order_group: orderGroups[0],
    })
}
