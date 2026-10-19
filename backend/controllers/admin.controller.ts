import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/backend/db/prisma";
import {
  AUTH_COOKIE_NAME,
  generateAdminToken,
  getExpectedToken,
  verifyAuthToken,
  verifyAdminPassword,
} from "@/backend/middleware/adminAuth";
import {
  getSystemSettings,
  updateSystemSettings,
  addCredits,
  deductCredits,
  getUserBalance,
} from "@/backend/services/credits.service";
import { completePaymentAndCreditWallet } from "@/backend/services/payments.service";
import {
  saveTemplateV2,
  deleteTemplate,
  duplicateTemplate,
  isValidTemplateId,
  isValidImageFilename,
  TemplateConfig,
} from "@/backend/services/templates.service";
import {
  updateAdminSettingsSchema,
  adjustAdminCreditsSchema,
} from "@/backend/schemas/settings.schema";

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function adminLoginController(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || !(await verifyAdminPassword(password))) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = await generateAdminToken();
    const response = NextResponse.json({ success: true });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

export async function adminLogoutController() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

export async function getAdminSettingsController(_req: Request) {
  try {
    const settings = await getSystemSettings();
    return NextResponse.json({ settings });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function updateAdminSettingsController(req: Request) {
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const isAdmin = await verifyAuthToken(adminToken);

    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
    }

    const json = await req.json();
    const parseResult = updateAdminSettingsSchema.safeParse(json);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid settings input" },
        { status: 400 }
      );
    }

    const updated = await updateSystemSettings(parseResult.data);

    return NextResponse.json({ success: true, settings: updated });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}

export async function getAdminPaymentsController(_req: Request) {
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const isAdmin = await verifyAuthToken(adminToken);

    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
    }

    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        package: true,
        user: {
          select: { id: true, email: true },
        },
      },
      take: 100,
    });

    return NextResponse.json({ payments });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch payments" }, { status: 500 });
  }
}

export async function approveAdminPaymentController(req: Request) {
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const isAdmin = await verifyAuthToken(adminToken);

    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
    }

    const body = await req.json();
    const { paymentId, providerRef } = body;

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
    }

    const result = await completePaymentAndCreditWallet(
      paymentId,
      providerRef || `admin_approved_${Date.now()}`
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Approval failed" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      alreadyProcessed: result.alreadyProcessed || false,
      message: result.alreadyProcessed
        ? "Payment was already processed previously."
        : "Payment approved successfully. Credits added to user wallet.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Approval failed" }, { status: 500 });
  }
}

export {
  createAdminPackageController,
  updateAdminPackageController,
  deleteAdminPackageController,
} from "./admin.packages.controller";

export async function saveAdminTemplateController(request: Request) {
  try {
    const formData = await request.formData();
    const configStr = formData.get("config")?.toString();
    let config: TemplateConfig | null = null;

    if (configStr) {
      try {
        config = JSON.parse(configStr);
      } catch {
        return NextResponse.json({ error: "Invalid config JSON" }, { status: 400 });
      }
    }

    if (!config) {
      const name = formData.get("name")?.toString().trim();
      const width = parseInt(formData.get("width")?.toString() || "1200", 10);
      const height = parseInt(formData.get("height")?.toString() || "1600", 10);
      const slotsStr = formData.get("slots")?.toString();
      const category = formData.get("category")?.toString().trim() || "General";
      const tagsStr = formData.get("tags")?.toString();

      if (!name) {
        return NextResponse.json({ error: "Template name is required" }, { status: 400 });
      }

      let slots = [];
      try {
        slots = JSON.parse(slotsStr || "[]");
      } catch {
        slots = [];
      }

      let tags: string[] = [];
      if (tagsStr) {
        tags = tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
      }

      const sanitizedName = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .slice(0, 20);
      const id = `t_${sanitizedName || "template"}_${Date.now()}`;

      config = {
        schemaVersion: 2,
        id,
        name,
        category,
        tags,
        styles: [],
        layouts: [
          {
            id: "default",
            name: "Default Layout",
            width,
            height,
            blank: "blank.png",
            overlay: "overlay.png",
            overlayZ: 50,
            slots,
          },
        ],
        variants: [],
        width,
        height,
        slots,
        overlay: "overlay.png",
        overlayZ: 50,
      };
    }

    if (!config.id || !isValidTemplateId(config.id)) {
      const sanitizedName = (config.name || "template")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .slice(0, 20);
      config.id = `t_${sanitizedName || "template"}_${Date.now()}`;
    }

    const fileBuffers: Record<string, Buffer> = {};
    for (const [key, value] of formData.entries()) {
      if (value instanceof File && value.size > 0) {
        let filename = value.name;
        if (key === "blank") filename = "blank.png";
        else if (key === "sample") filename = "sample.png";
        else if (key === "overlay") filename = "overlay.png";

        if (!isValidImageFilename(filename)) {
          filename = `${filename.replace(/[^a-zA-Z0-9_-]/g, "")}.png`;
        }

        if (ALLOWED_MIME_TYPES.includes(value.type) || filename.endsWith(".png") || filename.endsWith(".jpg") || filename.endsWith(".webp")) {
          if (value.size <= MAX_FILE_SIZE) {
            fileBuffers[filename] = Buffer.from(await value.arrayBuffer());
          }
        }
      }
    }

    await saveTemplateV2(config, fileBuffers);

    return NextResponse.json({ success: true, id: config.id, config });
  } catch (err: any) {
    console.error("Failed to save template:", err);
    return NextResponse.json({ error: err.message || "Failed to save template" }, { status: 500 });
  }
}

export async function deleteAdminTemplateController(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isValidTemplateId(id)) {
      return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
    }

    const success = await deleteTemplate(id);
    if (!success) {
      return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete template error:", err);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}

export async function duplicateAdminTemplateController(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!isValidTemplateId(id)) {
      return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
    }

    const duplicated = await duplicateTemplate(id);
    if (!duplicated) {
      return NextResponse.json({ error: "Failed to duplicate template" }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: duplicated.id, config: duplicated });
  } catch (err: any) {
    console.error("Duplicate template error:", err);
    return NextResponse.json({ error: err.message || "Failed to duplicate template" }, { status: 500 });
  }
}

export async function adjustAdminCreditsController(req: Request) {
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const isAdmin = await verifyAuthToken(adminToken);

    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = adjustAdminCreditsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid credit adjustment parameters" },
        { status: 400 }
      );
    }

    const { userId, email, amount: numAmount, reason } = parseResult.data;

    let targetUser = null;
    if (userId) {
      targetUser = await prisma.user.findUnique({ where: { id: userId } });
    } else if (email) {
      targetUser = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    }

    if (!targetUser) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    let result;

    if (numAmount > 0) {
      result = await addCredits(
        targetUser.id,
        numAmount,
        "bonus",
        reason || "Admin manual credit grant",
        "admin_adjustment"
      );
    } else {
      result = await deductCredits(
        targetUser.id,
        Math.abs(numAmount),
        reason || "Admin manual credit deduction",
        "admin_adjustment"
      );
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Credit adjustment failed." }, { status: 400 });
    }

    const newBalance = await getUserBalance(targetUser.id);

    return NextResponse.json({
      success: true,
      userId: targetUser.id,
      email: targetUser.email,
      newBalance,
      message: `Successfully adjusted credits by ${numAmount > 0 ? "+" : ""}${numAmount}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Adjustment failed" }, { status: 500 });
  }
}
