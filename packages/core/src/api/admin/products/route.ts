import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework";
import { HttpTypes } from "@mercurjs/types";
import { AdminGetProductsParamsType } from "./validators";

export declare const GET: (req: AuthenticatedMedusaRequest<AdminGetProductsParamsType>, res: MedusaResponse<HttpTypes.AdminProductListResponse>) => Promise<void>;

export async function OPTIONS(_req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.status(204).send();
}