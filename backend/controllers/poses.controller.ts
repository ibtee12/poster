import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/backend/db/prisma";
import { getCurrentUser } from "@/backend/services/auth.service";
import { isCallerAdmin } from "@/backend/middleware/auth";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/backend/middleware/adminAuth";
import { rateLimiter, getClientIp, rateLimitResponse } from "@/backend/middleware/rateLimit";
import {
  getSystemSettings,
  checkDailySpendingCap,
  deductCredits,
  deductCreditsWithCap,
  addCredits,
  getUserBalance,
} from "@/backend/services/credits.service";
import { imageModerator } from "@/backend/services/moderation.service";
import { posterStorage } from "@/backend/services/posterStorage.service";
import { getPoseGenerator } from "@/backend/services/poseGenerator.service";
import { validateImageBuffer } from "@/backend/common/images";

async function processPoseJobAsync(
  jobId: string,
  userId: string,
  poseId: string,
  userPhotoBuffer: Buffer,
  userPhotoMimeType: string,
  creditCost: number,
  prompt?: string
) {
  try {
    const pose = await prisma.pose.findUnique({
      where: { id: poseId },
    });

    if (!pose) {
      throw new Error("Referenced pose was not found or was removed.");
    }

    let poseRefBuffer: Buffer | undefined;
    let poseRefUrl: string | undefined = pose.referenceImagePath;

    if (pose.referenceImagePath.startsWith("/api/posters/files/")) {
      const relPath = pose.referenceImagePath.replace("/api/posters/files/", "");
      const buf = await posterStorage.getFile(relPath);
      if (buf) poseRefBuffer = buf;
    }

    const generator = getPoseGenerator();
    const generatedBuffer = await generator.generate({
      userPhotoBuffer,
      userPhotoMimeType,
      poseRefBuffer,
      poseRefUrl,
      prompt,
    });

    const outMod = await imageModerator.moderateImage(generatedBuffer, "image/png");
    if (!outMod.allowed) {
      throw new Error(outMod.reason || "The AI generated photo was flagged by safety moderation.");
    }

    const outPath = `poses/outputs/${jobId}.png`;
    const outputUrl = await posterStorage.saveFile(outPath, generatedBuffer, "image/png");

    await prisma.poseJob.update({
      where: { id: jobId },
      data: {
        status: "succeeded",
        outputImagePath: outputUrl,
      },
    });
  } catch (err: any) {
    console.error(`PoseJob ${jobId} failed:`, err);

    try {
      await prisma.poseJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          error: err.message || "AI pose generation encountered an internal error.",
        },
      });
    } catch (statusErr) {
      console.error(`Failed to update job status to failed for ${jobId}:`, statusErr);
    }

    // Refund independent of the status update
    try {
      await addCredits(
        userId,
        creditCost,
        "refund",
        `Refund for failed AI pose generation: ${err.message || "Generation error"}`,
        jobId
      );
      console.log(`Successfully refunded ${creditCost} credits to user ${userId} for job ${jobId}`);
    } catch (refundErr) {
      console.error(`Failed to refund credits for job ${jobId}:`, refundErr);
    }
  }
}

export async function getPosesController(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const showAll = searchParams.get("all") === "true";

    let isAdmin = false;
    if (showAll) {
      const cookieStore = await cookies();
      const adminToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
      isAdmin = await verifyAuthToken(adminToken);
    }

    const poses = await prisma.pose.findMany({
      where: isAdmin && showAll ? {} : { active: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ poses });
  } catch (err: any) {
    console.error("Failed to fetch poses:", err);
    return NextResponse.json({ error: "Failed to fetch poses" }, { status: 500 });
  }
}

export async function createPoseController(req: Request) {
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const isAdmin = await verifyAuthToken(adminToken);

    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";

    let name = "";
    let category = "General";
    let previewImagePath = "";
    let referenceImagePath = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      name = (formData.get("name") as string)?.trim() || "";
      category = (formData.get("category") as string)?.trim() || "General";

      const previewFile = formData.get("preview") as File | null;
      const refFile = formData.get("reference") as File | null;

      if (!name) {
        return NextResponse.json({ error: "Pose name is required" }, { status: 400 });
      }

      if (previewFile && previewFile.size > 0) {
        const buf = Buffer.from(await previewFile.arrayBuffer());
        const ext = previewFile.name.split(".").pop() || "png";
        const filename = `poses/preview_${Date.now()}_${crypto.randomUUID()}.${ext}`;
        previewImagePath = await posterStorage.saveFile(filename, buf, previewFile.type);
      }

      if (refFile && refFile.size > 0) {
        const buf = Buffer.from(await refFile.arrayBuffer());
        const ext = refFile.name.split(".").pop() || "png";
        const filename = `poses/ref_${Date.now()}_${crypto.randomUUID()}.${ext}`;
        referenceImagePath = await posterStorage.saveFile(filename, buf, refFile.type);
      }
    } else {
      const body = await req.json();
      name = body.name?.trim();
      category = body.category?.trim() || "General";
      previewImagePath = body.previewImagePath || "";
      referenceImagePath = body.referenceImagePath || "";
    }

    if (!name) {
      return NextResponse.json({ error: "Pose name is required" }, { status: 400 });
    }

    if (!previewImagePath) {
      previewImagePath = "/poses/sample_pose.png";
    }
    if (!referenceImagePath) {
      referenceImagePath = previewImagePath;
    }

    const pose = await prisma.pose.create({
      data: {
        name,
        category,
        previewImagePath,
        referenceImagePath,
        active: true,
      },
    });

    return NextResponse.json({ success: true, pose }, { status: 201 });
  } catch (err: any) {
    console.error("Failed to create pose:", err);
    return NextResponse.json({ error: err.message || "Failed to create pose" }, { status: 500 });
  }
}

export async function getPoseByIdController(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pose = await prisma.pose.findUnique({
      where: { id },
    });

    if (!pose) {
      return NextResponse.json({ error: "Pose not found" }, { status: 404 });
    }

    return NextResponse.json({ pose });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch pose" }, { status: 500 });
  }
}

export async function updatePoseController(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const isAdmin = await verifyAuthToken(adminToken);

    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const pose = await prisma.pose.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.active !== undefined && { active: Boolean(body.active) }),
        ...(body.previewImagePath !== undefined && { previewImagePath: body.previewImagePath }),
        ...(body.referenceImagePath !== undefined && { referenceImagePath: body.referenceImagePath }),
      },
    });

    return NextResponse.json({ success: true, pose });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update pose" }, { status: 500 });
  }
}

export async function deletePoseController(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const isAdmin = await verifyAuthToken(adminToken);

    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
    }

    const { id } = await params;
    await prisma.pose.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete pose" }, { status: 500 });
  }
}

export async function generatePoseController(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required. Please log in or create an account to use AI poses." },
        { status: 401 }
      );
    }

    const settings = await getSystemSettings();
    if (settings.aiKillSwitch) {
      return NextResponse.json(
        {
          error: "AI pose generation is temporarily disabled by administrator. Please try again later.",
          killSwitchActive: true,
        },
        { status: 403 }
      );
    }

    const clientIp = getClientIp(req);
    const rateCheck = await rateLimiter.check(`pose_gen_${user.id}_${clientIp}`, 10, 60);
    if (!rateCheck.success) {
      return rateLimitResponse("You are requesting AI generations too quickly. Please wait a minute.");
    }

    const creditCost = settings.poseGenerationCreditCost;

    const contentType = req.headers.get("content-type") || "";
    let poseId = "";
    let photoBuffer: Buffer | null = null;
    let mimeType = "image/png";
    let prompt: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      poseId = (formData.get("poseId") as string) || "";
      prompt = (formData.get("prompt") as string) || undefined;
      const file = formData.get("photo") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No photo provided." }, { status: 400 });
      }

      mimeType = file.type || "image/png";
      photoBuffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = await req.json();
      poseId = body.poseId;
      prompt = body.prompt;

      if (!body.photoBase64) {
        return NextResponse.json({ error: "Photo data is required." }, { status: 400 });
      }

      const base64Data = body.photoBase64.replace(/^data:image\/\w+;base64,/, "");
      photoBuffer = Buffer.from(base64Data, "base64");
      mimeType = body.mimeType || "image/png";
    }

    if (!poseId) {
      return NextResponse.json({ error: "poseId is required." }, { status: 400 });
    }

    if (!photoBuffer || photoBuffer.length === 0) {
      return NextResponse.json({ error: "Invalid photo content." }, { status: 400 });
    }

    // Size limit and magic bytes validation
    const imgValidation = validateImageBuffer(photoBuffer, 10 * 1024 * 1024);
    if (!imgValidation.valid) {
      return NextResponse.json({ error: imgValidation.error }, { status: 400 });
    }
    mimeType = imgValidation.mimeType || mimeType;

    const pose = await prisma.pose.findUnique({
      where: { id: poseId },
    });

    if (!pose) {
      return NextResponse.json({ error: "Pose not found." }, { status: 404 });
    }

    // Reject inactive poses
    if (!pose.active) {
      return NextResponse.json({ error: "Selected pose is currently inactive." }, { status: 400 });
    }

    const inputMod = await imageModerator.moderateImage(photoBuffer, mimeType);
    if (!inputMod.allowed) {
      return NextResponse.json(
        { error: inputMod.reason || "The uploaded photo was flagged by safety moderation." },
        { status: 400 }
      );
    }

    // Atomic spending cap check and credit deduction
    const deduction = await deductCreditsWithCap(
      user.id,
      creditCost,
      `AI Pose Generation: ${pose.name}`,
      `pose_${poseId}`
    );

    if (!deduction.success) {
      if (deduction.capExceeded) {
        return NextResponse.json(
          {
            error: deduction.error,
            currentSpent: deduction.currentSpent,
            cap: deduction.cap,
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        {
          error: deduction.error || "Insufficient credit balance. Please purchase credits to generate AI poses.",
          cost: creditCost,
        },
        { status: 402 }
      );
    }

    // Saving input image, creating job, and starting async generation with refund on ANY failure
    let job;
    try {
      const inPath = `poses/inputs/${Date.now()}_${crypto.randomUUID()}.${imgValidation.format || "png"}`;
      const inputUrl = await posterStorage.saveFile(inPath, photoBuffer, mimeType);

      job = await prisma.poseJob.create({
        data: {
          userId: user.id,
          poseId: pose.id,
          status: "processing",
          inputImagePath: inputUrl,
          creditCost,
        },
      });

      processPoseJobAsync(
        job.id,
        user.id,
        pose.id,
        photoBuffer,
        mimeType,
        creditCost,
        prompt
      ).catch((err) => {
        console.error("Unhandled error in background pose job:", err);
      });
    } catch (saveOrJobErr: any) {
      console.error("Failed to save input or create pose job:", saveOrJobErr);
      try {
        await addCredits(
          user.id,
          creditCost,
          "refund",
          "Refund due to system error initiating pose job"
        );
      } catch (refundErr) {
        console.error("Failed to refund credits:", refundErr);
      }
      return NextResponse.json(
        { error: "Failed to initiate AI pose generation. Credits refunded." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        status: "processing",
        cost: creditCost,
        newBalance: deduction.newBalance,
      },
      { status: 202 }
    );
  } catch (err: any) {
    console.error("Failed to initiate pose generation:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function getPoseJobStatusController(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);
    const isAdmin = await isCallerAdmin(req);

    if (!user && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const job = await prisma.poseJob.findUnique({
      where: { id },
      include: {
        pose: {
          select: { name: true, category: true },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!isAdmin && job.userId !== user?.id) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Fail and refund jobs stuck in "processing" for more than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (job.status === "processing" && job.createdAt < tenMinutesAgo) {
      try {
        await prisma.poseJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            error: "Job timed out after 10 minutes.",
          },
        });
        job.status = "failed";
        job.error = "Job timed out after 10 minutes.";
        await addCredits(
          job.userId,
          job.creditCost,
          "refund",
          "Refund for timed out pose generation job",
          job.id
        );
      } catch (timeoutErr) {
        console.error("Error timing out stuck pose job:", timeoutErr);
      }
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      outputImagePath: job.outputImagePath,
      error: job.error,
      creditCost: job.creditCost,
      poseName: job.pose.name,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to query job status" }, { status: 500 });
  }
}
