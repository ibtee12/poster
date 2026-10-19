import { handle } from "@/backend/middleware/handle";
import { withUser } from "@/backend/middleware/auth";
import { withValidation } from "@/backend/middleware/validate";
import { withRateLimit } from "@/backend/middleware/rateLimit";
import { createPosterSchema } from "@/backend/schemas/posters.schema";
import {
  getUserPostersController,
  createPosterController,
} from "@/backend/controllers/posters.controller";

export const GET = handle(withUser(getUserPostersController));
export const POST = handle(
  withRateLimit("posters_create", 30, 60)(
    withUser(withValidation({ body: createPosterSchema }, createPosterController))
  )
);
