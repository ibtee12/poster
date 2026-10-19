import { handle } from "@/backend/middleware/handle";
import { withAdmin } from "@/backend/middleware/auth";
import { getAdminPaymentsController } from "@/backend/controllers/admin.controller";

export const GET = handle(withAdmin(getAdminPaymentsController, "Unauthorized"));
