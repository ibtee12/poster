import { z } from "zod";

export const templateIdParamsSchema = z.object({
  id: z
    .string()
    .min(1, "Template ID is required")
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid template ID"),
});

export const templateImageParamsSchema = z.object({
  id: z
    .string()
    .min(1, "Template ID is required")
    .regex(/^[a-zA-Z0-9_-]+$/, "Invalid template ID"),
  filename: z
    .string()
    .min(1, "Filename is required")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Invalid image filename")
    .refine(
      (name) => /\.(png|jpg|jpeg|webp)$/i.test(name),
      "Only .png, .jpg, .jpeg, and .webp filenames allowed"
    ),
});
