import { prisma } from "../db/prisma";
import { posterStorage } from "./posterStorage.service";
import { recordAnalyticsEvent } from "./analytics.service";
import {
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "../common/errors";
import type { CreatePosterInput } from "../schemas/posters.schema";

export async function getUserPosters(userId: string) {
  const posters = await prisma.poster.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return { posters };
}

export async function createPoster(userId: string, input: CreatePosterInput) {
  const poster = await prisma.poster.create({
    data: {
      userId,
      templateId: input.templateId,
      layoutId: input.layoutId || null,
      variantId: input.variantId || null,
      textValues: input.textValues || {},
      adjustments: input.adjustments || {},
      title: input.title || "My Custom Poster",
      previewImagePath: "",
    },
  });

  let previewPath = "";
  if (input.previewImageBase64) {
    const cleanB64 = input.previewImageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleanB64, "base64");
    previewPath = await posterStorage.saveFile(`${poster.id}/preview.png`, buffer, "image/png");
  }

  let finalPath: string | null = null;
  if (input.finalImageBase64) {
    const cleanB64 = input.finalImageBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(cleanB64, "base64");
    finalPath = await posterStorage.saveFile(`${poster.id}/final.png`, buffer, "image/png");
  }

  const updatedPoster = await prisma.poster.update({
    where: { id: poster.id },
    data: {
      previewImagePath: previewPath,
      finalImagePath: finalPath,
    },
  });

  await recordAnalyticsEvent({
    sessionId: input.sessionId || "anon",
    eventType: "poster_saved",
    templateId: input.templateId,
    layoutId: input.layoutId || undefined,
    metadata: { posterId: poster.id },
  });

  return { success: true, poster: updatedPoster };
}

export async function getPosterById(
  id: string,
  requester: { id?: string; isAdmin: boolean }
) {
  if (!requester.id && !requester.isAdmin) {
    throw new UnauthorizedError("Unauthorized");
  }

  const poster = await prisma.poster.findUnique({
    where: { id },
  });

  if (!poster) {
    throw new NotFoundError("Poster not found");
  }

  if (!requester.isAdmin && poster.userId !== requester.id) {
    throw new NotFoundError("Poster not found");
  }

  const { userId, ...safePoster } = poster;
  return { poster: requester.isAdmin ? poster : safePoster };
}

export async function deletePoster(id: string, userId: string) {
  const poster = await prisma.poster.findUnique({
    where: { id },
  });

  if (!poster) {
    throw new NotFoundError("Poster not found");
  }

  if (poster.userId !== userId) {
    throw new ForbiddenError("Forbidden");
  }

  await posterStorage.deleteFile(`${id}/preview.png`);
  await posterStorage.deleteFile(`${id}/final.png`);

  await prisma.poster.delete({
    where: { id },
  });

  return { success: true };
}

export async function duplicatePoster(id: string, userId: string) {
  const original = await prisma.poster.findUnique({
    where: { id },
  });

  if (!original) {
    throw new NotFoundError("Poster not found");
  }

  if (original.userId !== userId) {
    throw new ForbiddenError("Forbidden");
  }

  const duplicate = await prisma.poster.create({
    data: {
      userId,
      templateId: original.templateId,
      layoutId: original.layoutId,
      variantId: original.variantId,
      textValues: original.textValues ?? {},
      adjustments: original.adjustments ?? {},
      cutoutPaths: original.cutoutPaths ?? {},
      title: `${original.title || "Poster"} (Copy)`,
      previewImagePath: "",
    },
  });

  const origBuffer = await posterStorage.getFile(`${id}/preview.png`);
  if (origBuffer) {
    const newPreviewPath = await posterStorage.saveFile(
      `${duplicate.id}/preview.png`,
      origBuffer,
      "image/png"
    );
    await prisma.poster.update({
      where: { id: duplicate.id },
      data: { previewImagePath: newPreviewPath },
    });
  }

  return { success: true, poster: duplicate };
}

export async function getPosterFile(
  pathSegments: string[],
  requester: { id?: string; isAdmin: boolean }
): Promise<{ buffer: Buffer; contentType: string }> {
  const relativePath = pathSegments.join("/");

  if (relativePath.includes("..") || relativePath.startsWith("/")) {
    throw new NotFoundError("Invalid path");
  }

  // Authorization checks
  if (pathSegments.length >= 2 && pathSegments[0] === "poses") {
    const sub = pathSegments[1];
    if (sub === "inputs") {
      const filename = pathSegments.slice(2).join("/");
      const job = await prisma.poseJob.findFirst({
        where: { inputImagePath: { contains: filename } },
        select: { userId: true },
      });
      if (!job || (!requester.isAdmin && job.userId !== requester.id)) {
        throw new NotFoundError("File not found");
      }
    } else if (sub === "outputs") {
      const filename = pathSegments.slice(2).join("/");
      const jobId = filename.replace(/\.[^/.]+$/, "");
      const job = await prisma.poseJob.findFirst({
        where: {
          OR: [{ id: jobId }, { outputImagePath: { contains: filename } }],
        },
        select: { userId: true },
      });
      if (!job || (!requester.isAdmin && job.userId !== requester.id)) {
        throw new NotFoundError("File not found");
      }
    }
  } else if (pathSegments.length >= 1) {
    const posterId = pathSegments[0];
    const poster = await prisma.poster.findUnique({
      where: { id: posterId },
      select: { userId: true },
    });
    if (!poster || (!requester.isAdmin && poster.userId !== requester.id)) {
      throw new NotFoundError("File not found");
    }
  }

  const buffer = await posterStorage.getFile(relativePath);
  if (!buffer) {
    throw new NotFoundError("File not found");
  }

  let contentType = "image/png";
  if (relativePath.endsWith(".jpg") || relativePath.endsWith(".jpeg")) {
    contentType = "image/jpeg";
  } else if (relativePath.endsWith(".webp")) {
    contentType = "image/webp";
  }

  return { buffer, contentType };
}
