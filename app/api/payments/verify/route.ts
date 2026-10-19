import { handle } from "@/backend/middleware/handle";
import { withUserOrAdmin } from "@/backend/middleware/auth";
import { verifyPaymentController } from "@/backend/controllers/payments.controller";

export const POST = handle(
  withUserOrAdmin(verifyPaymentController, "Authentication required")
);
