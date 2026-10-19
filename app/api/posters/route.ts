import { handle } from "@/backend/middleware/handle";
import { withUser } from "@/backend/middleware/auth";
import { withValidation } from "@/backend/middleware/validate";
import { createPosterSchema } from "@/backend/schemas/posters.schema";
import {
  getUserPostersController,
  createPosterController,
} from "@/backend/controllers/posters.controller";

export const GET = handle(withUser(getUserPostersController));
export const POST = handle(
  withUser(withValidation({ body: createPosterSchema }, createPosterController))
);
