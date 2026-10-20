import { z } from "zod";

export const createPaymentSchema = z.object({
  packageId: z.string().min(1, "packageId is required"),
  providerName: z.string().optional(),
});

export const verifyPaymentSchema = z.object({
  paymentId: z.string().min(1, "paymentId is required"),
  extraParams: z.any().optional(),
});

export const paymentIdParamSchema = z.object({
  id: z.string().min(1, "paymentId is required"),
});
