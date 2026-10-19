import { z } from "zod";

export const posterIdParamsSchema = z.object({
  id: z.string().min(1, "Poster ID is required"),
});

export const createPosterSchema = z.object({
  templateId: z.string({ message: "templateId is required" }).min(1, "templateId is required"),
  layoutId: z.string().optional().nullable(),
  variantId: z.string().optional().nullable(),
  textValues: z.record(z.string(), z.any()).optional().default({}),
  adjustments: z.record(z.string(), z.any()).optional().default({}),
  previewImageBase64: z.string().optional(),
  finalImageBase64: z.string().optional(),
  title: z.string().optional(),
  sessionId: z.string().optional(),
});

export const posterFilePathParamsSchema = z.object({
  path: z.array(z.string()).min(1, "Path is required"),
});

export type PosterIdParamsInput = z.infer<typeof posterIdParamsSchema>;
export type CreatePosterInput = z.infer<typeof createPosterSchema>;
export type PosterFilePathParamsInput = z.infer<typeof posterFilePathParamsSchema>;
