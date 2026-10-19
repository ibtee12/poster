import { handle } from "@/backend/middleware/handle";
import { withUserOrAdmin } from "@/backend/middleware/auth";
import { getPoseJobStatusController } from "@/backend/controllers/poses.controller";

export const GET = handle(withUserOrAdmin(getPoseJobStatusController, "Unauthorized"));
