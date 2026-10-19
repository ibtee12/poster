import { handle } from "@/backend/middleware/handle";
import { withUser } from "@/backend/middleware/auth";
import { createPaymentController } from "@/backend/controllers/payments.controller";

export const POST = handle(
  withUser(createPaymentController, "Authentication required. Please log in to purchase credits.")
);
