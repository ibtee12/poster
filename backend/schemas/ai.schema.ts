import { z } from "zod";

export const suggestSlogansSchema = z.object({
  text: z
    .string()
    .min(2, "Text must be at least 2 characters")
    .max(300, "Text must be at most 300 characters"),
  maxChars: z.number().int().min(10).max(500).optional().default(60),
  category: z.string().max(100).optional(),
});

export type SuggestSlogansInput = z.infer<typeof suggestSlogansSchema>;
