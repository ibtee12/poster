import { handle } from "@/backend/middleware/handle";
import { withUserOrAdmin } from "@/backend/middleware/auth";
import { getPaymentByIdController } from "@/backend/controllers/payments.controller";

export const GET = handle(
  withUserOrAdmin(getPaymentByIdController, "Unauthorized")
);
