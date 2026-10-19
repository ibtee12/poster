import { z } from "zod";

export const addBlocklistWordSchema = z.object({
  word: z
    .string({ message: "Word is required" })
    .trim()
    .min(1, "Word is required"),
  category: z.string().optional().default("misuse"),
});

export const deleteBlocklistWordSchema = z.object({
  word: z
    .string({ message: "Word query param is required" })
    .trim()
    .min(1, "Word query param is required"),
});

export type AddBlocklistWordInput = z.infer<typeof addBlocklistWordSchema>;
export type DeleteBlocklistWordInput = z.infer<typeof deleteBlocklistWordSchema>;
