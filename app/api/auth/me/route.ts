import { handle } from "@/backend/middleware/handle";
import { withOptionalUser } from "@/backend/middleware/auth";
import { meController } from "@/backend/controllers/auth.controller";

export const GET = handle(withOptionalUser(meController));
