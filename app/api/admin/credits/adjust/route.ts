import { handle } from "@/backend/middleware/handle";
import { withAdmin } from "@/backend/middleware/auth";
import { adjustAdminCreditsController } from "@/backend/controllers/admin.controller";

export const POST = handle(withAdmin(adjustAdminCreditsController, "Unauthorized"));
