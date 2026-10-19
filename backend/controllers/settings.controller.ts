import { getSystemSettings } from "@/backend/services/credits.service";

export async function getPublicSettingsController() {
  const settings = await getSystemSettings();
  return {
    settings: {
      cleanDownloadCreditCost: settings.cleanDownloadCreditCost,
      poseGenerationCreditCost: settings.poseGenerationCreditCost,
      aiKillSwitch: settings.aiKillSwitch,
    },
  };
}
