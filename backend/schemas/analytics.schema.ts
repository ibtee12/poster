import { z } from "zod";

export const logAnalyticsEventSchema = z.object({
  eventType: z
    .string({ message: "eventType is required" })
    .min(1, "eventType is required"),
  sessionId: z.string().optional(),
  templateId: z.string().optional(),
  layoutId: z.string().optional(),
  format: z.string().optional(),
  errorType: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const analyticsQuerySchema = z.object({
  range: z.string().optional(),
});

export type LogAnalyticsEventInput = z.infer<typeof logAnalyticsEventSchema>;
export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
