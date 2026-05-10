import { model } from "@medusajs/framework/utils"
import Seller from "./seller"

const ProfessionalDetails = model.define("ProfessionalDetails", {
  id: model.id({ prefix: "selprodet" }).primaryKey(),
  corporate_name: model.text().nullable(),
  registration_number: model.text().nullable(),
  tax_id: model.text().nullable(),
  county: model.text().nullable(),
  national_id_number: model.text().nullable(),
  kra_pin: model.text().nullable(),
  ownership_attestation: model.boolean().default(false),
  animal_health_attestation: model.boolean().default(false),
  movement_permit_reference: model.text().nullable(),
  livestock_health_record_urls: model.json().nullable(),
  equipment_document_urls: model.json().nullable(),
  seller: model.belongsTo(() => Seller, {
    mappedBy: "professional_details",
  }),
})

export default ProfessionalDetails
