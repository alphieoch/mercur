import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Checkbox, Input, Textarea, toast } from "@medusajs/ui";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import * as zod from "zod";

import { FileType, FileUpload } from "@components/common/file-upload";
import { Form } from "@components/common/form";
import { RouteDrawer, useRouteModal } from "@components/modals";
import { KeyboundForm } from "@components/utilities/keybound-form";
import { HttpTypes } from "@mercurjs/types";
import { useUpdateSellerProfessionalDetails } from "@hooks/api";
import { uploadFilesQuery } from "@lib/client";

type StoreProfessionalDetailsFormProps = {
  seller: HttpTypes.StoreSellerResponse["seller"];
};

const StoreProfessionalDetailsSchema = zod.object({
  corporate_name: zod.string().optional().or(zod.literal("")),
  registration_number: zod.string().optional().or(zod.literal("")),
  tax_id: zod.string().optional().or(zod.literal("")),
  county: zod.string().optional().or(zod.literal("")),
  national_id_number: zod.string().optional().or(zod.literal("")),
  kra_pin: zod.string().optional().or(zod.literal("")),
  movement_permit_reference: zod.string().optional().or(zod.literal("")),
  ownership_attestation: zod.boolean().default(false),
  animal_health_attestation: zod.boolean().default(false),
  livestock_health_record_urls: zod.array(zod.string().url()).default([]),
  equipment_document_urls: zod.array(zod.string().url()).default([]),
});

export const StoreProfessionalDetailsForm = ({
  seller,
}: StoreProfessionalDetailsFormProps) => {
  const { t } = useTranslation();
  const { handleSuccess } = useRouteModal();
  const details = seller.professional_details;
  const [isUploadingHealth, setIsUploadingHealth] = useState(false);
  const [isUploadingEquipment, setIsUploadingEquipment] = useState(false);

  const form = useForm<zod.infer<typeof StoreProfessionalDetailsSchema>>({
    defaultValues: {
      corporate_name: details?.corporate_name ?? "",
      registration_number: details?.registration_number ?? "",
      tax_id: details?.tax_id ?? "",
      county: details?.county ?? "",
      national_id_number: details?.national_id_number ?? "",
      kra_pin: details?.kra_pin ?? "",
      movement_permit_reference: details?.movement_permit_reference ?? "",
      ownership_attestation: Boolean(details?.ownership_attestation),
      animal_health_attestation: Boolean(details?.animal_health_attestation),
      livestock_health_record_urls: details?.livestock_health_record_urls ?? [],
      equipment_document_urls: details?.equipment_document_urls ?? [],
    },
    resolver: zodResolver(StoreProfessionalDetailsSchema),
  });

  const { mutateAsync, isPending } = useUpdateSellerProfessionalDetails(
    seller.id,
  );

  const uploadComplianceFiles = async (
    files: FileType[],
    field: "livestock_health_record_urls" | "equipment_document_urls"
  ) => {
    const setUploading =
      field === "livestock_health_record_urls"
        ? setIsUploadingHealth
        : setIsUploadingEquipment;

    setUploading(true);
    try {
      const uploaded = await uploadFilesQuery(files);
      const urls = (uploaded?.files ?? [])
        .map((file: { url?: string }) => file.url)
        .filter(Boolean) as string[];

      if (!urls.length) {
        toast.error(t("actions.error", "No files were uploaded."));
        return;
      }

      const existing = form.getValues(field) ?? [];
      form.setValue(field, [...existing, ...urls], {
        shouldDirty: true,
        shouldTouch: true,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("actions.error", "Upload failed."));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    await mutateAsync(
      {
        corporate_name: values.corporate_name || null,
        registration_number: values.registration_number || null,
        tax_id: values.tax_id || null,
        county: values.county || null,
        national_id_number: values.national_id_number || null,
        kra_pin: values.kra_pin || null,
        movement_permit_reference: values.movement_permit_reference || null,
        ownership_attestation: values.ownership_attestation,
        animal_health_attestation: values.animal_health_attestation,
        livestock_health_record_urls: values.livestock_health_record_urls.length
          ? values.livestock_health_record_urls
          : null,
        equipment_document_urls: values.equipment_document_urls.length
          ? values.equipment_document_urls
          : null,
      },
      {
        onSuccess: () => {
          toast.success(
            t("store.professionalDetails.edit.successToast"),
          );
          handleSuccess();
        },
        onError: (error: Error) => {
          toast.error(error.message);
        },
      },
    );
  });

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <RouteDrawer.Body className="flex flex-col gap-y-4 overflow-y-auto">
          <Form.Field
            control={form.control}
            name="corporate_name"
            render={({ field }) => (
              <Form.Item>
                <Form.Label optional>
                  {t("store.professionalDetails.fields.corporateName")}
                </Form.Label>
                <Form.Control>
                  <Input size="small" {...field} />
                </Form.Control>
                <Form.ErrorMessage />
              </Form.Item>
            )}
          />
          <Form.Field
            control={form.control}
            name="registration_number"
            render={({ field }) => (
              <Form.Item>
                <Form.Label optional>
                  {t("store.professionalDetails.fields.registrationNumber")}
                </Form.Label>
                <Form.Control>
                  <Input size="small" {...field} />
                </Form.Control>
                <Form.ErrorMessage />
              </Form.Item>
            )}
          />
          <Form.Field
            control={form.control}
            name="tax_id"
            render={({ field }) => (
              <Form.Item>
                <Form.Label optional>
                  {t("store.professionalDetails.fields.taxId")}
                </Form.Label>
                <Form.Control>
                  <Input size="small" {...field} />
                </Form.Control>
                <Form.ErrorMessage />
              </Form.Item>
            )}
          />
          <Form.Field
            control={form.control}
            name="county"
            render={({ field }) => (
              <Form.Item>
                <Form.Label optional>
                  {t("store.professionalDetails.fields.county", "County")}
                </Form.Label>
                <Form.Control>
                  <Input size="small" {...field} />
                </Form.Control>
                <Form.ErrorMessage />
              </Form.Item>
            )}
          />
          <Form.Field
            control={form.control}
            name="national_id_number"
            render={({ field }) => (
              <Form.Item>
                <Form.Label>
                  {t("store.professionalDetails.fields.nationalId", "National ID / Passport")}
                </Form.Label>
                <Form.Control>
                  <Input size="small" {...field} />
                </Form.Control>
                <Form.ErrorMessage />
              </Form.Item>
            )}
          />
          <Form.Field
            control={form.control}
            name="kra_pin"
            render={({ field }) => (
              <Form.Item>
                <Form.Label optional>
                  {t("store.professionalDetails.fields.kraPin", "KRA PIN")}
                </Form.Label>
                <Form.Control>
                  <Input size="small" {...field} />
                </Form.Control>
                <Form.ErrorMessage />
              </Form.Item>
            )}
          />
          <Form.Field
            control={form.control}
            name="movement_permit_reference"
            render={({ field }) => (
              <Form.Item>
                <Form.Label optional>
                  {t("store.professionalDetails.fields.movementPermit", "Movement permit reference")}
                </Form.Label>
                <Form.Control>
                  <Textarea rows={2} {...field} />
                </Form.Control>
                <Form.ErrorMessage />
              </Form.Item>
            )}
          />
          <Form.Field
            control={form.control}
            name="ownership_attestation"
            render={({ field }) => (
              <Form.Item>
                <Form.Label>
                  {t(
                    "store.professionalDetails.fields.ownershipAttestation",
                    "I confirm I have lawful ownership/right to sell listed livestock or equipment."
                  )}
                </Form.Label>
                <Form.Control>
                  <Checkbox
                    checked={Boolean(field.value)}
                    onCheckedChange={(value) => field.onChange(Boolean(value))}
                  />
                </Form.Control>
                <Form.ErrorMessage />
              </Form.Item>
            )}
          />
          <Form.Field
            control={form.control}
            name="animal_health_attestation"
            render={({ field }) => (
              <Form.Item>
                <Form.Label>
                  {t(
                    "store.professionalDetails.fields.healthAttestation",
                    "I confirm livestock sold through this store has required health checks/records."
                  )}
                </Form.Label>
                <Form.Control>
                  <Checkbox
                    checked={Boolean(field.value)}
                    onCheckedChange={(value) => field.onChange(Boolean(value))}
                  />
                </Form.Control>
                <Form.ErrorMessage />
              </Form.Item>
            )}
          />
          <Form.Item>
            <Form.Label optional>
              {t("store.professionalDetails.fields.healthRecords", "Livestock health records")}
            </Form.Label>
            <Form.Control>
              <FileUpload
                label={t("store.professionalDetails.uploadLabel", "Upload compliance files")}
                hint={t(
                  "store.professionalDetails.healthRecordsHint",
                  "Upload vaccination cards, veterinary reports, or breeding health certificates."
                )}
                formats={["application/pdf", "image/png", "image/jpeg", "image/webp"]}
                multiple
                onUploaded={(files) => uploadComplianceFiles(files, "livestock_health_record_urls")}
              />
            </Form.Control>
            <Form.Hint>
              {isUploadingHealth
                ? t("actions.saving", "Saving...")
                : t(
                  "store.professionalDetails.healthRecordsHintSecondary",
                  "Uploaded files are attached to your seller profile for admin review."
                )}
            </Form.Hint>
          </Form.Item>
          <Form.Item>
            <Form.Label optional>
              {t("store.professionalDetails.fields.equipmentDocs", "Equipment ownership/import documents")}
            </Form.Label>
            <Form.Control>
              <FileUpload
                label={t("store.professionalDetails.uploadLabel", "Upload compliance files")}
                hint={t(
                  "store.professionalDetails.equipmentDocsHint",
                  "Upload invoices, serial logbooks, certificates of origin, or KEBS conformity docs."
                )}
                formats={["application/pdf", "image/png", "image/jpeg", "image/webp"]}
                multiple
                onUploaded={(files) => uploadComplianceFiles(files, "equipment_document_urls")}
              />
            </Form.Control>
            <Form.Hint>
              {isUploadingEquipment
                ? t("actions.saving", "Saving...")
                : t(
                  "store.professionalDetails.equipmentDocsHintSecondary",
                  "Attach machinery documents if you sell tractors or imported farm equipment."
                )}
            </Form.Hint>
          </Form.Item>
        </RouteDrawer.Body>
        <RouteDrawer.Footer>
          <div className="flex items-center justify-end gap-x-2">
            <RouteDrawer.Close asChild>
              <Button variant="secondary" size="small">
                {t("actions.cancel")}
              </Button>
            </RouteDrawer.Close>
            <Button type="submit" size="small" isLoading={isPending}>
              {t("actions.save")}
            </Button>
          </div>
        </RouteDrawer.Footer>
      </KeyboundForm>
    </RouteDrawer.Form>
  );
};
