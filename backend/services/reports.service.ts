import { prisma } from "../db/prisma";
import { NotFoundError } from "../common/errors";
import { posterStorage } from "./posterStorage.service";
import type { SubmitReportInput, ResolveReportInput } from "../schemas/reports.schema";

export async function submitReport(userId: string | null, data: SubmitReportInput) {
  if (data.posterId) {
    const poster = await prisma.poster.findUnique({
      where: { id: data.posterId },
    });
    if (!poster) {
      throw new NotFoundError("Poster not found");
    }
  }

  const report = await prisma.report.create({
    data: {
      posterId: data.posterId || null,
      userId: userId || null,
      reason: data.reason,
      details: data.details || null,
      status: "pending",
    },
  });

  return { success: true, reportId: report.id };
}

export async function getReports(status = "all") {
  const where: any = {};
  if (status && status !== "all") {
    where.status = status;
  }

  const reports = await prisma.report.findMany({
    where,
    include: {
      poster: true,
      user: { select: { id: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return { success: true, reports };
}

export async function resolveReport(id: string, data: ResolveReportInput) {
  const report = await prisma.report.findUnique({
    where: { id },
  });

  if (!report) {
    throw new NotFoundError("Report not found");
  }

  if (data.deletePoster && report.posterId) {
    try {
      await posterStorage.deleteFile(`${report.posterId}/preview.png`);
      await posterStorage.deleteFile(`${report.posterId}/final.png`);
      await prisma.poster.delete({ where: { id: report.posterId } });
    } catch (delErr) {
      console.warn("Offending poster already deleted or not found:", delErr);
    }
  }

  const updated = await prisma.report.update({
    where: { id },
    data: {
      status: data.status || "resolved",
      resolutionNote: data.resolutionNote || null,
      resolvedAt: new Date(),
    },
  });

  return { success: true, report: updated };
}
