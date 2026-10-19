import { handle } from "@/backend/middleware/handle";
import { getAllTemplatesController } from "@/backend/controllers/templates.controller";

export const GET = handle(getAllTemplatesController);
