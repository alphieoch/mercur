import { z } from "zod";

export type StoreConfirmOrderReceiptType = z.infer<typeof StoreConfirmOrderReceipt>;
export const StoreConfirmOrderReceipt = z.object({
  accepted_terms: z.boolean().default(true),
  handover_notes: z.string().max(500).nullable().optional(),
});
