import { handle } from "@/backend/middleware/handle";
import { webhookController } from "@/backend/controllers/payments.controller";

export const POST = handle(webhookController);
