import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/backend/db/prisma";
import { getCurrentUser } from "@/backend/services/auth.service";
import { AUTH_COOKIE_NAME } from "@/backend/config/constants";
import { verifyAuthToken } from "@/backend/middleware/adminAuth";
import {
  getPaymentProvider,
  getEnabledProviders,
  completePaymentAndCreditWallet,
} from "@/backend/services/payments.service";
import { getUserBalance } from "@/backend/services/credits.service";

async function isCallerAdmin(req: Request): Promise<boolean> {
  const cookieHeader = req.headers.get("cookie");
  let adminToken: string | undefined;
  if (cookieHeader) {
    const match = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
    if (match) adminToken = match.split("=")[1];
  }
  if (!adminToken) {
    try {
      const cookieStore = await cookies();
      adminToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    } catch {
      // Not in cookies context
    }
  }
  return verifyAuthToken(adminToken);
}

export async function createPaymentController(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required. Please log in to purchase credits." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { packageId, providerName } = body;

    if (!packageId) {
      return NextResponse.json({ error: "packageId is required" }, { status: 400 });
    }

    if (providerName) {
      const enabled = getEnabledProviders();
      if (!enabled.includes(String(providerName).toLowerCase())) {
        return NextResponse.json(
          { error: `Payment provider '${providerName}' is not available.` },
          { status: 400 }
        );
      }
    }

    const pkg = await prisma.package.findUnique({
      where: { id: packageId },
    });

    if (!pkg || !pkg.active) {
      return NextResponse.json({ error: "Package not found or inactive" }, { status: 404 });
    }

    const provider = getPaymentProvider(providerName);
    const result = await provider.createPayment({
      userId: user.id,
      packageId: pkg.id,
      amount: pkg.price,
      currency: pkg.currency || "BDT",
    });

    return NextResponse.json({
      success: true,
      paymentId: result.paymentId,
      redirectUrl: result.redirectUrl,
    });
  } catch (err: any) {
    console.error("Failed to create payment:", err);
    return NextResponse.json({ error: err.message || "Failed to create payment" }, { status: 500 });
  }
}

export async function verifyPaymentController(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const isAdmin = await isCallerAdmin(req);

    if (!user && !isAdmin) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { paymentId, extraParams } = body;

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { package: true },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // A non-owner must never be able to change a payment's status (admin can access all)
    if (!isAdmin && payment.userId !== user?.id) {
      return NextResponse.json(
        { error: "Forbidden. You do not own this payment." },
        { status: 403 }
      );
    }

    if (payment.status === "paid") {
      const balance = await getUserBalance(payment.userId);
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        message: "Payment already processed and credited.",
        balance,
      });
    }

    const provider = getPaymentProvider(payment.provider);
    const verifyResult = await provider.verifyPayment(paymentId, extraParams);

    if (!verifyResult.success) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: "failed" },
      });

      return NextResponse.json(
        { success: false, error: verifyResult.error || "Payment verification failed" },
        { status: 400 }
      );
    }

    // Verify amount and currency reported by provider match payment.amount and package currency
    const amountPaid = verifyResult.amountPaid ?? payment.amount;
    const currencyPaid = (verifyResult.currency || payment.currency || "BDT").toUpperCase();
    const expectedCurrency = (payment.package.currency || payment.currency || "BDT").toUpperCase();

    if (Math.abs(amountPaid - payment.amount) > 0.01 || currencyPaid !== expectedCurrency) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: "failed" },
      });
      return NextResponse.json(
        { success: false, error: "Payment verification failed: amount or currency mismatch" },
        { status: 400 }
      );
    }

    const creditResult = await completePaymentAndCreditWallet(
      paymentId,
      verifyResult.providerRef,
      { allowFromFailed: true }
    );

    if (!creditResult.success) {
      return NextResponse.json(
        { success: false, error: creditResult.error || "Failed to credit wallet" },
        { status: 500 }
      );
    }

    const balance = await getUserBalance(payment.userId);

    return NextResponse.json({
      success: true,
      alreadyProcessed: creditResult.alreadyProcessed || false,
      message: "Payment verified successfully. Credits added to wallet.",
      balance,
    });
  } catch (err: any) {
    console.error("Verification error:", err);
    return NextResponse.json({ error: "Verification error occurred" }, { status: 500 });
  }
}

export async function webhookController(req: Request) {
  try {
    let payload: any = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      const text = await req.text();
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
    }

    // Only real providers handle public webhooks. Manual provider fallback is removed.
    const bkashProvider = getPaymentProvider("bkash");
    const result = await bkashProvider.handleWebhook(payload);

    if (!result.handled || !result.paymentId) {
      return NextResponse.json({ error: "Webhook not recognized or unhandled" }, { status: 400 });
    }

    // If a provider cannot be verified, the webhook rejects it with 400
    if (!result.success) {
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 });
    }

    // Verify amount and currency reported by provider match payment.amount and package currency
    const payment = await prisma.payment.findUnique({
      where: { id: result.paymentId },
      include: { package: true },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (result.amountPaid !== undefined) {
      const currencyPaid = (result.currency || payment.currency || "BDT").toUpperCase();
      const expectedCurrency = (payment.package.currency || payment.currency || "BDT").toUpperCase();

      if (Math.abs(result.amountPaid - payment.amount) > 0.01 || currencyPaid !== expectedCurrency) {
        return NextResponse.json(
          { error: "Payment verification failed: amount or currency mismatch" },
          { status: 400 }
        );
      }
    }

    const creditResult = await completePaymentAndCreditWallet(
      result.paymentId,
      result.providerRef,
      { allowFromFailed: true }
    );

    return NextResponse.json({
      success: true,
      handled: true,
      paymentId: result.paymentId,
      alreadyProcessed: creditResult.alreadyProcessed || false,
    });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: err.message || "Webhook processing error" }, { status: 500 });
  }
}

export async function getPaymentByIdController(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(req);
    const isAdmin = await isCallerAdmin(req);

    if (!user && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        package: true,
        user: {
          select: { id: true, email: true },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Must be owner or admin
    if (!isAdmin && payment.userId !== user?.id) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // getPaymentById must not return the user's email to non-admins
    const sanitizedPayment = {
      ...payment,
      user: isAdmin ? payment.user : { id: payment.userId },
    };

    return NextResponse.json({ payment: sanitizedPayment });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch payment" }, { status: 500 });
  }
}

