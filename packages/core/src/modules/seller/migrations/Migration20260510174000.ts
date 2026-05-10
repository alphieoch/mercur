import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260510174000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "professional_details" add column if not exists "county" text null;`);
    this.addSql(`alter table if exists "professional_details" add column if not exists "national_id_number" text null;`);
    this.addSql(`alter table if exists "professional_details" add column if not exists "kra_pin" text null;`);
    this.addSql(`alter table if exists "professional_details" add column if not exists "ownership_attestation" boolean not null default false;`);
    this.addSql(`alter table if exists "professional_details" add column if not exists "animal_health_attestation" boolean not null default false;`);
    this.addSql(`alter table if exists "professional_details" add column if not exists "movement_permit_reference" text null;`);
    this.addSql(`alter table if exists "professional_details" add column if not exists "livestock_health_record_urls" jsonb null;`);
    this.addSql(`alter table if exists "professional_details" add column if not exists "equipment_document_urls" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "professional_details" drop column if exists "equipment_document_urls";`);
    this.addSql(`alter table if exists "professional_details" drop column if exists "livestock_health_record_urls";`);
    this.addSql(`alter table if exists "professional_details" drop column if exists "movement_permit_reference";`);
    this.addSql(`alter table if exists "professional_details" drop column if exists "animal_health_attestation";`);
    this.addSql(`alter table if exists "professional_details" drop column if exists "ownership_attestation";`);
    this.addSql(`alter table if exists "professional_details" drop column if exists "kra_pin";`);
    this.addSql(`alter table if exists "professional_details" drop column if exists "national_id_number";`);
    this.addSql(`alter table if exists "professional_details" drop column if exists "county";`);
  }
}
