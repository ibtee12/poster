import { handle } from "@/backend/middleware/handle";
import { withValidation } from "@/backend/middleware/validate";
import { templateImageParamsSchema } from "@/backend/schemas/templates.schema";
import { getTemplateImageController } from "@/backend/controllers/templates.controller";

export const GET = handle(
  withValidation({ params: templateImageParamsSchema }, getTemplateImageController)
);
