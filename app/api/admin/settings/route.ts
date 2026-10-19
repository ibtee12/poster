import { handle } from "@/backend/middleware/handle";
import { withAdmin } from "@/backend/middleware/auth";
import {
  getAdminSettingsController,
  updateAdminSettingsController,
} from "@/backend/controllers/admin.controller";

export const GET = handle(withAdmin(getAdminSettingsController, "Unauthorized"));
export const POST = handle(withAdmin(updateAdminSettingsController, "Unauthorized"));
