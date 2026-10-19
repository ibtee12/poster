import { handle } from "@/backend/middleware/handle";
import { withOptionalUser } from "@/backend/middleware/auth";
import { getBalanceController } from "@/backend/controllers/credits.controller";

export const GET = handle(withOptionalUser(getBalanceController));

