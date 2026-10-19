import { getSystemSettings } from "@/backend/services/credits.service";

export async function getPublicSettingsController() {
  const settings = await getSystemSettings();
  return { settings };
}
