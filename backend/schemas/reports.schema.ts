import { z } from "zod";

export const submitReportSchema = z.object({
  reason: z
    .string({ message: "Please provide a reason for the report" })
    .trim()
    .min(1, "Please provide a reason for the report"),
  posterId: z.string().optional(),
  details: z.string().optional(),
});

export const reportIdParamsSchema = z.object({
  id: z.string().min(1, "Report ID is required"),
});

export const resolveReportSchema = z.object({
  status: z.string().optional(),
  resolutionNote: z.string().optional(),
  deletePoster: z.boolean().optional(),
});

export const getReportsQuerySchema = z.object({
  status: z.string().optional(),
});

export type SubmitReportInput = z.infer<typeof submitReportSchema>;
export type ReportIdParamsInput = z.infer<typeof reportIdParamsSchema>;
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
export type GetReportsQueryInput = z.infer<typeof getReportsQuerySchema>;
