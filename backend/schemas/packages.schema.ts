import { z } from "zod";

export const getPackagesQuerySchema = z.object({
  all: z.enum(["true", "false"]).optional(),
});

export const packageIdParamsSchema = z.object({
  id: z.string().min(1, "Package ID is required"),
});

export const createPackageSchema = z.object({
  name: z
    .string({ message: "name, credits and price are required" })
    .trim()
    .min(1, "name, credits and price are required"),
  credits: z.coerce.number({ message: "name, credits and price are required" }),
  price: z.coerce.number({ message: "name, credits and price are required" }),
  currency: z.string().optional(),
  active: z.boolean().optional(),
  badge: z.string().optional(),
});

export const updatePackageSchema = z.object({
  name: z.string().trim().min(1).optional(),
  credits: z.coerce.number().optional(),
  price: z.coerce.number().optional(),
  currency: z.string().optional(),
  active: z.boolean().optional(),
  badge: z.string().optional(),
});

export type GetPackagesQueryInput = z.infer<typeof getPackagesQuerySchema>;
export type PackageIdParamsInput = z.infer<typeof packageIdParamsSchema>;
export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
