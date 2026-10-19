import { NextResponse } from "next/server";
import { prisma } from "@/backend/db/prisma";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
  AppError,
} from "@/backend/common/errors";
import {
  getSystemSettings,
  deductCreditsWithCap,
  addCredits,
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

export async function getPosesController(req: Request, ctx?: any) {
  const { searchParams } = new URL(req.url);
  const showAll = searchParams.get("all") === "true";
  const isAdmin = ctx?.isAdmin || false;

  const poses = await prisma.pose.findMany({
    where: isAdmin && showAll ? {} : { active: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ poses });
}

export async function createPoseController(req: Request, _ctx?: any) {
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
      throw new BadRequestError("Pose name is required");
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
    throw new BadRequestError("Pose name is required");
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
}

export async function getPoseByIdController(
  _req: Request,
  ctx?: any
) {
  const resolvedParams = ctx?.params ? await ctx.params : {};
  const id = resolvedParams.id;

  const pose = await prisma.pose.findUnique({
    where: { id },
  });

  if (!pose) {
    throw new NotFoundError("Pose not found");
  }

  return NextResponse.json({ pose });
}

export async function updatePoseController(
  req: Request,
  ctx?: any
) {
  const resolvedParams = ctx?.params ? await ctx.params : {};
  const id = resolvedParams.id;
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
}

export async function deletePoseController(
  _req: Request,
  ctx?: any
) {
  const resolvedParams = ctx?.params ? await ctx.params : {};
  const id = resolvedParams.id;

  await prisma.pose.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}

export async function generatePoseController(req: Request, ctx?: any) {
  const user = ctx?.user;

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
      throw new BadRequestError("No photo provided.");
    }

    mimeType = file.type || "image/png";
    photoBuffer = Buffer.from(await file.arrayBuffer());
  } else {
    const body = await req.json();
    poseId = body.poseId;
    prompt = body.prompt;

    if (!body.photoBase64) {
      throw new BadRequestError("Photo data is required.");
    }

    const base64Data = body.photoBase64.replace(/^data:image\/\w+;base64,/, "");
    photoBuffer = Buffer.from(base64Data, "base64");
    mimeType = body.mimeType || "image/png";
  }

  if (!poseId) {
    throw new BadRequestError("poseId is required.");
  }

  if (!photoBuffer || photoBuffer.length === 0) {
    throw new BadRequestError("Invalid photo content.");
  }

  // Size limit and magic bytes validation
  const imgValidation = validateImageBuffer(photoBuffer, 10 * 1024 * 1024);
  if (!imgValidation.valid) {
    throw new BadRequestError(imgValidation.error);
  }
  mimeType = imgValidation.mimeType || mimeType;

  const pose = await prisma.pose.findUnique({
    where: { id: poseId },
  });

  if (!pose) {
    throw new NotFoundError("Pose not found.");
  }

  // Reject inactive poses
  if (!pose.active) {
    throw new BadRequestError("Selected pose is currently inactive.");
  }

  const inputMod = await imageModerator.moderateImage(photoBuffer, mimeType);
  if (!inputMod.allowed) {
    throw new BadRequestError(inputMod.reason || "The uploaded photo was flagged by safety moderation.");
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
}

export async function getPoseJobStatusController(
  req: Request,
  ctx?: any
) {
  const user = ctx?.user;
  const isAdmin = ctx?.isAdmin;

  const resolvedParams = ctx?.params ? await ctx.params : {};
  const id = resolvedParams.id;

  const job = await prisma.poseJob.findUnique({
    where: { id },
    include: {
      pose: {
        select: { name: true, category: true },
      },
    },
  });

  if (!job) {
    throw new NotFoundError("Job not found");
  }

  if (!isAdmin && job.userId !== user?.id) {
    throw new NotFoundError("Job not found");
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
}
