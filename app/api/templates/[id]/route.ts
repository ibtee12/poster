import { handle } from "@/backend/middleware/handle";
import { withValidation } from "@/backend/middleware/validate";
import { templateIdParamsSchema } from "@/backend/schemas/templates.schema";
import { getTemplateByIdController } from "@/backend/controllers/templates.controller";

export const GET = handle(
  withValidation({ params: templateIdParamsSchema }, getTemplateByIdController)
);
