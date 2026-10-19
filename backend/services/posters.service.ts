import { prisma } from "../db/prisma";
import { posterStorage } from "./posterStorage.service";
import { recordAnalyticsEvent } from "./analytics.service";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "../common/errors";
import { getTemplateById } from "./templates.service";
import { checkTextAgainstBlocklist } from "./safety.service";
import { validateImageBuffer } from "../common/images";
import type { CreatePosterInput } from "../schemas/posters.schema";

export async function getUserPosters(userId: string) {
  const posters = await prisma.poster.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return { posters };
}

export async function createPoster(userId: string, input: CreatePosterInput) {
  // 1. Template must exist
  await getTemplateById(input.templateId);

  // 2. Server-side blocklist check on textValues
  try {
    await checkTextAgainstBlocklist(input.textValues);
  } catch (err: any) {
    throw new BadRequestError(err.message || "Text values contain blocked words.");
  }

  // 3. Pre-validate image buffers before creating poster
  let previewBuffer: Buffer | null = null;
  let previewMime = "image/png";
  if (input.previewImageBase64) {
    const cleanB64 = input.previewImageBase64.replace(/^data:image\/\w+;base64,/, "");
    previewBuffer = Buffer.from(cleanB64, "base64");
    const val = validateImageBuffer(previewBuffer, 10 * 1024 * 1024);
    if (!val.valid) {
      throw new BadRequestError(`Invalid preview image: ${val.error}`);
    }
    previewMime = val.mimeType || "image/png";
  }

  let finalBuffer: Buffer | null = null;
  let finalMime = "image/png";
  if (input.finalImageBase64) {
    const cleanB64 = input.finalImageBase64.replace(/^data:image\/\w+;base64,/, "");
    finalBuffer = Buffer.from(cleanB64, "base64");
    const val = validateImageBuffer(finalBuffer, 10 * 1024 * 1024);
    if (!val.valid) {
      throw new BadRequestError(`Invalid final image: ${val.error}`);
    }
    finalMime = val.mimeType || "image/png";
  }

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
  if (previewBuffer) {
    previewPath = await posterStorage.saveFile(`${poster.id}/preview.png`, previewBuffer, previewMime);
  }

  let finalPath: string | null = null;
  if (finalBuffer) {
    finalPath = await posterStorage.saveFile(`${poster.id}/final.png`, finalBuffer, finalMime);
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
  // Decode each segment to protect against encoded path traversal (%2e%2e, %2f, etc.)
  const decodedSegments: string[] = [];
  for (const seg of pathSegments) {
    let decoded = seg;
    try {
      decoded = decodeURIComponent(seg);
    } catch {
      throw new NotFoundError("Invalid path");
    }

    if (
      decoded.includes("..") ||
      decoded.includes("/") ||
      decoded.includes("\\") ||
      decoded.includes("\0") ||
      decoded.includes("%2e") ||
      decoded.includes("%2f")
    ) {
      throw new NotFoundError("Invalid path");
    }
    decodedSegments.push(decoded);
  }

  const relativePath = decodedSegments.join("/");

  if (relativePath.includes("..") || relativePath.startsWith("/")) {
    throw new NotFoundError("Invalid path");
  }

  // Deny by default: paths must explicitly match an authorized pattern
  let isAuthorized = false;

  if (decodedSegments.length >= 2 && decodedSegments[0] === "poses") {
    const sub = decodedSegments[1];
    if (sub === "inputs") {
      const filename = decodedSegments.slice(2).join("/");
      if (!filename) throw new NotFoundError("File not found");
      const job = await prisma.poseJob.findFirst({
        where: { inputImagePath: { contains: filename } },
        select: { userId: true },
      });
      if (!job || (!requester.isAdmin && job.userId !== requester.id)) {
        throw new NotFoundError("File not found");
      }
      isAuthorized = true;
    } else if (sub === "outputs") {
      const filename = decodedSegments.slice(2).join("/");
      if (!filename) throw new NotFoundError("File not found");
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
      isAuthorized = true;
    } else {
      // Admin preset pose files: e.g. "poses/preview_..." or "poses/ref_..."
      // These are public reference images that must load for logged-out users,
      // but only if they match an existing record in the database!
      const pose = await prisma.pose.findFirst({
        where: {
          OR: [
            { previewImagePath: { contains: relativePath } },
            { referenceImagePath: { contains: relativePath } },
            { previewImagePath: `/api/posters/files/${relativePath}` },
            { referenceImagePath: `/api/posters/files/${relativePath}` },
          ],
        },
      });
      if (!pose) {
        throw new NotFoundError("File not found");
      }
      isAuthorized = true;
    }
  } else if (decodedSegments.length >= 2) {
    // User poster files: e.g. "<posterId>/preview.png" or "<posterId>/final.png"
    const posterId = decodedSegments[0];
    const poster = await prisma.poster.findUnique({
      where: { id: posterId },
      select: { userId: true },
    });
    if (!poster || (!requester.isAdmin && poster.userId !== requester.id)) {
      throw new NotFoundError("File not found");
    }
    isAuthorized = true;
  }

  // If not explicitly authorized, deny by default
  if (!isAuthorized) {
    throw new NotFoundError("File not found");
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
