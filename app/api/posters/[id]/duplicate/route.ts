import { handle } from "@/backend/middleware/handle";
import { withUser } from "@/backend/middleware/auth";
import { withValidation } from "@/backend/middleware/validate";
import { posterIdParamsSchema } from "@/backend/schemas/posters.schema";
import { duplicatePosterController } from "@/backend/controllers/posters.controller";

export const POST = handle(
  withUser(withValidation({ params: posterIdParamsSchema }, duplicatePosterController))
);
