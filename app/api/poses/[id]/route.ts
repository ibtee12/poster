import { handle } from "@/backend/middleware/handle";
import { withAdmin } from "@/backend/middleware/auth";
import {
  getPoseByIdController,
  updatePoseController,
  deletePoseController,
} from "@/backend/controllers/poses.controller";

export const GET = handle(getPoseByIdController);
export const PATCH = handle(withAdmin(updatePoseController, "Unauthorized. Admin access required."));
export const DELETE = handle(withAdmin(deletePoseController, "Unauthorized. Admin access required."));
