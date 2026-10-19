import { z } from "zod";

export const ALLOWED_EVENT_TYPES = [
  "template_opened",
  "photo_uploaded",
  "bg_removed",
  "text_entered",
  "poster_exported",
  "poster_saved",
  "error",
] as const;

export const logAnalyticsEventSchema = z.object({
  eventType: z
    .string({ message: "eventType is required" })
    .min(1, "eventType is required")
    .refine((val) => ALLOWED_EVENT_TYPES.includes(val as any), {
      message: `Invalid eventType. Allowed types: ${ALLOWED_EVENT_TYPES.join(", ")}`,
    }),
  sessionId: z.string().optional(),
  templateId: z.string().optional(),
  layoutId: z.string().optional(),
  format: z.string().optional(),
  errorType: z.string().optional(),
  metadata: z
    .record(z.string(), z.any())
    .optional()
    .refine(
      (val) => !val || Buffer.byteLength(JSON.stringify(val), "utf8") <= 2048,
      { message: "Metadata object exceeds 2 KB limit" }
    ),
});

export const analyticsQuerySchema = z.object({
  range: z
    .string()
    .optional()
    .transform((val) => {
      const allowed = ["24h", "7d", "30d", "90d"];
      return val && allowed.includes(val) ? val : "7d";
    }),
});

export type LogAnalyticsEventInput = z.infer<typeof logAnalyticsEventSchema>;
export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
