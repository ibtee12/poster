import { z } from "zod";

export const getPackagesQuerySchema = z.object({
  all: z.enum(["true", "false"]).optional(),
});

export const packageIdParamsSchema = z.object({
  id: z.string().min(1, "Package ID is required"),
});

const positiveCreditsCoerce = z
  .union([z.number(), z.string()], { message: "name, credits and price are required" })
  .pipe(z.coerce.number({ message: "name, credits and price are required" }))
  .refine((n) => !Number.isNaN(n), { message: "credits must be a valid number" })
  .refine((n) => n >= 0, { message: "credits cannot be negative" });

const positivePriceCoerce = z
  .union([z.number(), z.string()], { message: "name, credits and price are required" })
  .pipe(z.coerce.number({ message: "name, credits and price are required" }))
  .refine((n) => !Number.isNaN(n), { message: "price must be a valid number" })
  .refine((n) => n >= 0, { message: "price cannot be negative" });

const optionalCreditsCoerce = z
  .union([z.number(), z.string()])
  .pipe(z.coerce.number({ message: "credits must be a valid number" }))
  .refine((n) => !Number.isNaN(n), { message: "credits must be a valid number" })
  .refine((n) => n >= 0, { message: "credits cannot be negative" })
  .optional();

const optionalPriceCoerce = z
  .union([z.number(), z.string()])
  .pipe(z.coerce.number({ message: "price must be a valid number" }))
  .refine((n) => !Number.isNaN(n), { message: "price must be a valid number" })
  .refine((n) => n >= 0, { message: "price cannot be negative" })
  .optional();

export const createPackageSchema = z.object({
  name: z
    .string({ message: "name, credits and price are required" })
    .trim()
    .min(1, "name, credits and price are required"),
  credits: positiveCreditsCoerce,
  price: positivePriceCoerce,
  currency: z.string().optional(),
  active: z.boolean().optional(),
  badge: z.string().optional(),
});

export const updatePackageSchema = z.object({
  name: z.string().trim().min(1).optional(),
  credits: optionalCreditsCoerce,
  price: optionalPriceCoerce,
  currency: z.string().optional(),
  active: z.boolean().optional(),
  badge: z.string().optional(),
});

export type GetPackagesQueryInput = z.infer<typeof getPackagesQuerySchema>;
export type PackageIdParamsInput = z.infer<typeof packageIdParamsSchema>;
export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;

