import { handle } from "@/backend/middleware/handle";
import { withUser } from "@/backend/middleware/auth";
import { withRateLimit } from "@/backend/middleware/rateLimit";
import { generatePoseController } from "@/backend/controllers/poses.controller";

export const POST = handle(
  withRateLimit(
    "pose_gen",
    10,
    60,
    "You are requesting AI generations too quickly. Please wait a minute."
  )(
    withUser(
      generatePoseController,
      "Authentication required. Please log in or create an account to use AI poses."
    )
  )
);
