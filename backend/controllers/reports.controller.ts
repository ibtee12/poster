import * as reportsService from "@/backend/services/reports.service";
import type {
  SubmitReportInput,
  GetReportsQueryInput,
  ReportIdParamsInput,
  ResolveReportInput,
} from "@/backend/schemas/reports.schema";

export async function submitReportController(
  _req: Request,
  ctx: { validated: { body: SubmitReportInput }; user?: { id: string } | null }
) {
  return await reportsService.submitReport(ctx?.user?.id || null, ctx.validated.body);
}

export async function getReportsController(
  _req: Request,
  ctx: { validated: { query: GetReportsQueryInput } }
) {
  return await reportsService.getReports(ctx.validated.query.status);
}

export async function resolveReportController(
  _req: Request,
  ctx: { validated: { params: ReportIdParamsInput; body: ResolveReportInput } }
) {
  return await reportsService.resolveReport(ctx.validated.params.id, ctx.validated.body);
}
