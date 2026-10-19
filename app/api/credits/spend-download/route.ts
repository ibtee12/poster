import { handle } from "@/backend/middleware/handle";
import { spendDownloadController } from "@/backend/controllers/credits.controller";

export const POST = handle(spendDownloadController);

