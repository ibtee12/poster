import { handle } from "@/backend/middleware/handle";
import { withAdmin } from "@/backend/middleware/auth";
import { withValidation } from "@/backend/middleware/validate";
import { reportIdParamsSchema, resolveReportSchema } from "@/backend/schemas/reports.schema";
import { resolveReportController } from "@/backend/controllers/reports.controller";

export const PATCH = handle(
  withAdmin(
    withValidation(
      { params: reportIdParamsSchema, body: resolveReportSchema },
      resolveReportController
    ),
    "Unauthorized"
  )
);
