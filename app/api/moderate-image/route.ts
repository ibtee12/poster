import { handle } from "@/backend/middleware/handle";
import { moderateImageController } from "@/backend/controllers/ai.controller";

export const POST = handle(moderateImageController);
