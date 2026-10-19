import { handle } from "@/backend/middleware/handle";
import { withOptionalUser, withAdmin } from "@/backend/middleware/auth";
import { withValidation } from "@/backend/middleware/validate";
import { withRateLimit } from "@/backend/middleware/rateLimit";
import { submitReportSchema, getReportsQuerySchema } from "@/backend/schemas/reports.schema";
import {
  submitReportController,
  getReportsController,
} from "@/backend/controllers/reports.controller";

export const POST = handle(
  withRateLimit(
    "report:",
    5,
    600,
    "You have submitted multiple reports recently. Please wait a few minutes before reporting again."
  )(
    withOptionalUser(
      withValidation({ body: submitReportSchema }, submitReportController)
    )
  )
);

export const GET = handle(
  withAdmin(
    withValidation({ query: getReportsQuerySchema }, getReportsController),
    "Unauthorized"
  )
);
