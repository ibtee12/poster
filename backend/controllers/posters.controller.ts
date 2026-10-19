import { NextResponse } from "next/server";
import { getCurrentUser } from "@/backend/services/auth.service";
import { prisma } from "@/backend/db/prisma";
import { posterStorage } from "@/backend/services/posterStorage.service";
import { recordAnalyticsEvent } from "@/backend/services/analytics.service";

export async function getUserPostersController(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const posters = await prisma.poster.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ posters });
  } catch (err: any) {
    console.error("Fetch posters error:", err);
    return NextResponse.json({ error: "Failed to fetch posters" }, { status: 500 });
  }
}

export async function createPosterController(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const body = await req.json();
    const {
      templateId,
      layoutId,
      variantId,
      textValues = {},
      adjustments = {},
      previewImageBase64,
      finalImageBase64,
      title,
      sessionId,
    } = body;

    if (!templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }

    const poster = await prisma.poster.create({
      data: {
        userId: user.id,
        templateId,
        layoutId: layoutId || null,
        variantId: variantId || null,
        textValues: textValues || {},
        adjustments: adjustments || {},
        title: title || "My Custom Poster",
        previewImagePath: "",
      },
    });

    let previewPath = "";
    if (previewImageBase64) {
      const cleanB64 = previewImageBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(cleanB64, "base64");
      previewPath = await posterStorage.saveFile(`${poster.id}/preview.png`, buffer, "image/png");
    }

    let finalPath: string | null = null;
    if (finalImageBase64) {
      const cleanB64 = finalImageBase64.replace(/^data:image\/\w+;base64,/, "");
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
      sessionId: sessionId || "anon",
      eventType: "poster_saved",
      templateId,
      layoutId: layoutId || undefined,
      metadata: { posterId: poster.id },
    });

    return NextResponse.json({ success: true, poster: updatedPoster });
  } catch (err: any) {
    console.error("Save poster error:", err);
    return NextResponse.json({ error: "Failed to save poster" }, { status: 500 });
  }
}

export async function getPosterByIdController(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);

    const poster = await prisma.poster.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!poster) {
      return NextResponse.json({ error: "Poster not found" }, { status: 404 });
    }

    return NextResponse.json({ poster });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch poster" }, { status: 500 });
  }
}

export async function deletePosterController(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const poster = await prisma.poster.findUnique({
      where: { id },
    });

    if (!poster) {
      return NextResponse.json({ error: "Poster not found" }, { status: 404 });
    }

    if (poster.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await posterStorage.deleteFile(`${id}/preview.png`);
    await posterStorage.deleteFile(`${id}/final.png`);

    await prisma.poster.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Delete poster error:", err);
    return NextResponse.json({ error: "Failed to delete poster" }, { status: 500 });
  }
}

export async function duplicatePosterController(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const original = await prisma.poster.findUnique({
      where: { id },
    });

    if (!original) {
      return NextResponse.json({ error: "Poster not found" }, { status: 404 });
    }

    if (original.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const duplicate = await prisma.poster.create({
      data: {
        userId: user.id,
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

    return NextResponse.json({ success: true, poster: duplicate });
  } catch (err: any) {
    console.error("Duplicate poster error:", err);
    return NextResponse.json({ error: "Failed to duplicate poster" }, { status: 500 });
  }
}

export async function getPosterFileController(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const relativePath = pathSegments.join("/");

    if (relativePath.includes("..") || relativePath.startsWith("/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const buffer = await posterStorage.getFile(relativePath);
    if (!buffer) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    let contentType = "image/png";
    if (relativePath.endsWith(".jpg") || relativePath.endsWith(".jpeg")) {
      contentType = "image/jpeg";
    } else if (relativePath.endsWith(".webp")) {
      contentType = "image/webp";
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
