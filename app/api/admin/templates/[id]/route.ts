import { handle } from "@/backend/middleware/handle";
import { withAdmin } from "@/backend/middleware/auth";
import { deleteAdminTemplateController } from "@/backend/controllers/admin.controller";

export const DELETE = handle(withAdmin(deleteAdminTemplateController, "Unauthorized"));
