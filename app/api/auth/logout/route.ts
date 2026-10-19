import { handle } from "@/backend/middleware/handle";
import { logoutController } from "@/backend/controllers/auth.controller";

export const POST = handle(logoutController);
