import { handle } from "@/backend/middleware/handle";
import { getPublicSettingsController } from "@/backend/controllers/settings.controller";

export const GET = handle(getPublicSettingsController);
