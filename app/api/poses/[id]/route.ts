import {
  getPoseByIdController,
  updatePoseController,
  deletePoseController,
} from "@/backend/controllers/poses.controller";

export const GET = getPoseByIdController;
export const PATCH = updatePoseController;
export const DELETE = deletePoseController;
