import { z } from "zod";

export const updateAdminSettingsSchema = z.object({
  cleanDownloadCreditCost: z
    .preprocess((val) => (val !== undefined ? Number(val) : undefined), z.number({ message: "cleanDownloadCreditCost must be a valid number" }).int("cleanDownloadCreditCost must be an integer").min(0, "cleanDownloadCreditCost cannot be negative"))
    .optional(),
  poseGenerationCreditCost: z
    .preprocess((val) => (val !== undefined ? Number(val) : undefined), z.number({ message: "poseGenerationCreditCost must be a valid number" }).int("poseGenerationCreditCost must be an integer").min(0, "poseGenerationCreditCost cannot be negative"))
    .optional(),
  freeSignupCredits: z
    .preprocess((val) => (val !== undefined ? Number(val) : undefined), z.number({ message: "freeSignupCredits must be a valid number" }).int("freeSignupCredits must be an integer").min(0, "freeSignupCredits cannot be negative"))
    .optional(),
  dailySpendingCapPerUser: z
    .preprocess((val) => (val !== undefined ? Number(val) : undefined), z.number({ message: "dailySpendingCapPerUser must be a valid number" }).int("dailySpendingCapPerUser must be an integer").min(1, "dailySpendingCapPerUser must be at least 1"))
    .optional(),
  aiKillSwitch: z.boolean().optional(),
});

export const adjustAdminCreditsSchema = z
  .object({
    userId: z.string().optional(),
    email: z.string().email("Invalid email address").optional(),
    amount: z.preprocess(
      (val) => Number(val),
      z
        .number({ message: "amount must be a valid number" })
        .int("amount must be an integer")
        .refine((n) => !isNaN(n) && n !== 0, {
          message: "Non-zero amount is required.",
        })
    ),
    reason: z.string().optional(),
  })
  .refine((data) => Boolean(data.userId || data.email), {
    message: "User ID or email is required.",
  });

export type UpdateAdminSettingsInput = z.infer<typeof updateAdminSettingsSchema>;
export type AdjustAdminCreditsInput = z.infer<typeof adjustAdminCreditsSchema>;
