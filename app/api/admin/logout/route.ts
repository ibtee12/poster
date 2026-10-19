import { handle } from "@/backend/middleware/handle";
import { adminLogoutController } from "@/backend/controllers/admin.controller";

export const POST = handle(adminLogoutController);
