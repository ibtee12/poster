import { NextResponse } from "next/server";
import { rateLimiter, getClientIp, rateLimitResponse } from "@/backend/middleware/rateLimit";
import { imageModerator } from "@/backend/services/moderation.service";
import { recordAnalyticsEvent } from "@/backend/services/analytics.service";
import { validateImageBuffer } from "@/backend/common/images";

export async function removeBgController(request: Request) {
  try {
    const ip = getClientIp(request);

    // Per-IP rate limit
    const rateCheck = await rateLimiter.check(`removebg:${ip}`, 10, 60);
    if (!rateCheck.success) {
      return rateLimitResponse(
        "Too many background-removal requests. Please wait a moment before trying again."
      );
    }

    // Daily global cap check
    const todayKey = `removebg_global_daily:${new Date().toISOString().slice(0, 10)}`;
    const dailyCap = parseInt(process.env.REMOVE_BG_DAILY_CAP || "500", 10);
    const globalCapCheck = await rateLimiter.check(todayKey, dailyCap, 86400);
    if (!globalCapCheck.success) {
      return NextResponse.json(
        { error: "Daily background removal limit reached. Please try again tomorrow." },
        { status: 503 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "Missing photo file in request" }, { status: 400 });
    }

    // Size limit and magic-bytes check
    const photoBuffer = Buffer.from(await file.arrayBuffer());
    const val = validateImageBuffer(photoBuffer, 10 * 1024 * 1024);
    if (!val.valid) {
      return NextResponse.json({ error: val.error }, { status: 400 });
    }

    const provider = (process.env.REMOVE_BG_PROVIDER || "none").toLowerCase().trim();

    if (provider === "none") {
      return NextResponse.json(
        {
          error:
            "Background removal failed locally, and no server fallback provider is configured (REMOVE_BG_PROVIDER is 'none').",
        },
        { status: 503 }
      );
    }

    if (provider === "removebg") {
      const apiKey = process.env.REMOVE_BG_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "Server configuration error: REMOVE_BG_API_KEY is not configured on the server." },
          { status: 500 }
        );
      }

      const rbForm = new FormData();
      rbForm.append("image_file", file);
      rbForm.append("size", "auto");

      const rbResponse = await fetch("https://api.remove.bg/v1.0/removebg", {
        method: "POST",
        headers: {
          "X-Api-Key": apiKey,
        },
        body: rbForm,
      });

      if (!rbResponse.ok) {
        let errMessage = "remove.bg API request failed";
        try {
          const errData = await rbResponse.json();
          errMessage = errData.errors?.[0]?.title || errData.message || errMessage;
        } catch {
          errMessage = `remove.bg returned status ${rbResponse.status}`;
        }
        return NextResponse.json({ error: errMessage }, { status: 502 });
      }

      const buffer = await rbResponse.arrayBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
        },
      });
    }

    if (provider === "rembg_url") {
      const rembgUrl = process.env.REMBG_URL;
      if (!rembgUrl) {
        return NextResponse.json(
          { error: "Server configuration error: REMBG_URL is not configured on the server." },
          { status: 500 }
        );
      }

      const rembgForm = new FormData();
      rembgForm.append("file", file);

      const rembgResponse = await fetch(rembgUrl, {
        method: "POST",
        body: rembgForm,
      });

      if (!rembgResponse.ok) {
        return NextResponse.json(
          { error: `rembg service error: status ${rembgResponse.status}` },
          { status: 502 }
        );
      }

      const buffer = await rembgResponse.arrayBuffer();
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
        },
      });
    }

    return NextResponse.json(
      { error: `Unknown REMOVE_BG_PROVIDER: '${provider}'` },
      { status: 500 }
    );
  } catch (err: any) {
    console.error("Server remove-bg error:", err);
    return NextResponse.json({ error: "Server fallback processing failed" }, { status: 500 });
  }
}

export async function moderateImageController(req: Request) {
  try {
    const ip = getClientIp(req);

    const rateCheck = await rateLimiter.check(`upload:${ip}`, 30, 60);
    if (!rateCheck.success) {
      return rateLimitResponse(
        "Too many photo uploads in a short time. Please wait a minute before uploading another image."
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sessionId = (formData.get("sessionId") as string) || "anon";
    const templateId = (formData.get("templateId") as string) || undefined;

    if (!file) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await imageModerator.moderateImage(buffer, file.type);

    if (!result.allowed) {
      await recordAnalyticsEvent({
        sessionId,
        eventType: "error",
        templateId,
        errorType: "moderation_rejected",
        metadata: { reason: result.reason },
      });

      return NextResponse.json(
        {
          allowed: false,
          error:
            result.reason ||
            "The uploaded image contains restricted or explicit content. Please upload an appropriate photo with a clear human face.",
        },
        { status: 422 }
      );
    }

    await recordAnalyticsEvent({
      sessionId,
      eventType: "photo_uploaded",
      templateId,
      metadata: { size: file.size, type: file.type },
    });

    return NextResponse.json({ allowed: true });
  } catch (err: any) {
    console.error("Moderation endpoint error:", err);
    return NextResponse.json({ error: "Failed to process image moderation" }, { status: 500 });
  }
}
