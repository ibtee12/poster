import { handle } from "@/backend/middleware/handle";
import { withAdmin } from "@/backend/middleware/auth";
import { duplicateAdminTemplateController } from "@/backend/controllers/admin.controller";

export const POST = handle(withAdmin(duplicateAdminTemplateController, "Unauthorized"));
