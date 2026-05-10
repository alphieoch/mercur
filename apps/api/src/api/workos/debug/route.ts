import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve("query")
  const { data } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "metadata"],
  })

  return res.status(200).json({
    count: data.length,
    sellers: data.map((s: any) => ({
      id: s.id,
      name: s.name,
      metadata: s.metadata,
      workos_org_id: s.metadata?.workos_org_id,
    })),
  })
}
