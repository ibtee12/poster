import { handle } from "@/backend/middleware/handle";
import { withAdmin } from "@/backend/middleware/auth";
import { withValidation } from "@/backend/middleware/validate";
import { logAnalyticsEventSchema, analyticsQuerySchema } from "@/backend/schemas/analytics.schema";
import {
  logAnalyticsEventController,
  getAnalyticsSummaryController,
} from "@/backend/controllers/analytics.controller";

export const POST = handle(
  withValidation({ body: logAnalyticsEventSchema }, logAnalyticsEventController)
);

export const GET = handle(
  withAdmin(
    withValidation({ query: analyticsQuerySchema }, getAnalyticsSummaryController),
    "Unauthorized"
  )
);
