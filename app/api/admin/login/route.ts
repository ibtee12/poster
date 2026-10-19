import { handle } from "@/backend/middleware/handle";
import { adminLoginController } from "@/backend/controllers/admin.controller";
import { withRateLimit } from "@/backend/middleware/rateLimit";

export const POST = handle(
  withRateLimit(
    "admin_login",
    5,
    10 * 60,
    "Too many login attempts. Please wait a few moments and try again."
  )(adminLoginController)
);
