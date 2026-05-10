export function getSellerStorefrontHoursLine(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const storeHours = metadata.store_hours;
  if (typeof storeHours === "string" && storeHours.trim()) {
    return storeHours.trim();
  }

  const activeHours = metadata.active_hours;
  if (typeof activeHours === "string" && activeHours.trim()) {
    return activeHours.trim();
  }

  return null;
}
