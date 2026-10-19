import { handle } from "@/backend/middleware/handle";
import { withAdmin } from "@/backend/middleware/auth";
import {
  getPosesController,
  createPoseController,
} from "@/backend/controllers/poses.controller";

export const GET = handle(getPosesController);
export const POST = handle(withAdmin(createPoseController, "Unauthorized. Admin access required."));
