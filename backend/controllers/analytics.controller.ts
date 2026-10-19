import * as analyticsService from "@/backend/services/analytics.service";
import type { LogAnalyticsEventInput, AnalyticsQueryInput } from "@/backend/schemas/analytics.schema";

export async function logAnalyticsEventController(
  _req: Request,
  ctx: { validated: { body: LogAnalyticsEventInput } }
) {
  await analyticsService.recordAnalyticsEvent(ctx.validated.body);
  return { success: true };
}

export async function getAnalyticsSummaryController(
  _req: Request,
  ctx: { validated: { query: AnalyticsQueryInput } }
) {
  const range = ctx.validated.query.range || "7d";
  return await analyticsService.getSummaryByRange(range);
}
