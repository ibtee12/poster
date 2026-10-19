import { handle } from "@/backend/middleware/handle";
import { withOptionalUser, withUser } from "@/backend/middleware/auth";
import { withValidation } from "@/backend/middleware/validate";
import { posterIdParamsSchema } from "@/backend/schemas/posters.schema";
import {
  getPosterByIdController,
  deletePosterController,
} from "@/backend/controllers/posters.controller";

export const GET = handle(
  withOptionalUser(withValidation({ params: posterIdParamsSchema }, getPosterByIdController))
);
export const DELETE = handle(
  withUser(withValidation({ params: posterIdParamsSchema }, deletePosterController))
);
