import { prisma } from "../db/prisma";

export interface AnalyticsEventInput {
  sessionId?: string;
  eventType:
    | "template_opened"
    | "photo_uploaded"
    | "bg_removed"
    | "text_entered"
    | "poster_exported"
    | "poster_saved"
    | "error"
    | string;
  templateId?: string;
  layoutId?: string;
  format?: string;
  errorType?: string;
  metadata?: Record<string, any>;
}

export async function recordAnalyticsEvent(input: AnalyticsEventInput): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        sessionId: input.sessionId || "anonymous_session",
        eventType: input.eventType,
        templateId: input.templateId || null,
        layoutId: input.layoutId || null,
        format: input.format || null,
        errorType: input.errorType || null,
        metadata: input.metadata || {},
      },
    });
  } catch (err) {
    console.warn("Failed to record analytics event:", err);
  }
}

export interface AnalyticsSummary {
  totalEvents: number;
  uniqueSessions: number;
  opensCount: number;
  exportsCount: number;
  savesCount: number;
  completionRate: number; // percentage
  eventsByType: Record<string, number>;
  eventsByTemplate: Record<string, number>;
  topErrors: { errorType: string; count: number }[];
}

export async function getAnalyticsSummary(
  startDate?: Date,
  endDate?: Date
): Promise<AnalyticsSummary> {
  const where: any = {};
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const events = await prisma.analyticsEvent.findMany({
    where,
    select: {
      sessionId: true,
      eventType: true,
      templateId: true,
      errorType: true,
      createdAt: true,
    },
  });

  const totalEvents = events.length;
  const sessions = new Set<string>();
  const eventsByType: Record<string, number> = {};
  const eventsByTemplate: Record<string, number> = {};
  const errorCounts: Record<string, number> = {};

  for (const ev of events) {
    if (ev.sessionId) sessions.add(ev.sessionId);

    eventsByType[ev.eventType] = (eventsByType[ev.eventType] || 0) + 1;

    if (ev.templateId) {
      eventsByTemplate[ev.templateId] = (eventsByTemplate[ev.templateId] || 0) + 1;
    }

    if (ev.eventType === "error" && ev.errorType) {
      errorCounts[ev.errorType] = (errorCounts[ev.errorType] || 0) + 1;
    }
  }

  const opensCount = eventsByType["template_opened"] || 0;
  const exportsCount = eventsByType["poster_exported"] || 0;
  const savesCount = eventsByType["poster_saved"] || 0;

  const completionRate =
    opensCount > 0 ? Math.round((exportsCount / opensCount) * 1000) / 10 : 0;

  const topErrors = Object.entries(errorCounts)
    .map(([errorType, count]) => ({ errorType, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalEvents,
    uniqueSessions: sessions.size,
    opensCount,
    exportsCount,
    savesCount,
    completionRate,
    eventsByType,
    eventsByTemplate,
    topErrors,
  };
}

export async function getSummaryByRange(range = "7d") {
  let startDate: Date | undefined;
  const now = new Date();

  if (range === "24h") {
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (range === "7d") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (range === "30d") {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const summary = await getAnalyticsSummary(startDate, now);
  return { success: true, summary, range };
}
