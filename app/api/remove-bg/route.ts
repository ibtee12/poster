import { handle } from "@/backend/middleware/handle";
import { removeBgController } from "@/backend/controllers/ai.controller";

export const POST = handle(removeBgController);
