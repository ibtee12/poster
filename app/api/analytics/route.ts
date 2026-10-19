import { handle } from "@/backend/middleware/handle";
import { withAdmin } from "@/backend/middleware/auth";
import { withValidation } from "@/backend/middleware/validate";
import { withRateLimit } from "@/backend/middleware/rateLimit";
import { logAnalyticsEventSchema, analyticsQuerySchema } from "@/backend/schemas/analytics.schema";
import {
  logAnalyticsEventController,
  getAnalyticsSummaryController,
} from "@/backend/controllers/analytics.controller";

export const POST = handle(
  withRateLimit("analytics_log", 30, 60)(
    withValidation({ body: logAnalyticsEventSchema }, logAnalyticsEventController)
  )
);

export const GET = handle(
  withAdmin(
    withValidation({ query: analyticsQuerySchema }, getAnalyticsSummaryController),
    "Unauthorized"
  )
);
