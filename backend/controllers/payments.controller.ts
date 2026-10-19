import { NextResponse } from "next/server";
import { prisma } from "@/backend/db/prisma";
import { getCurrentUser } from "@/backend/services/auth.service";
import {
  getPaymentProvider,
  completePaymentAndCreditWallet,
} from "@/backend/services/payments.service";
import { getUserBalance } from "@/backend/services/credits.service";

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
    const body = await req.json();
    const { paymentId, extraParams } = body;

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
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

    const creditResult = await completePaymentAndCreditWallet(
      paymentId,
      verifyResult.providerRef
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
    return NextResponse.json({ error: err.message || "Verification error" }, { status: 500 });
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

    const bkashProvider = getPaymentProvider("bkash");
    let result = await bkashProvider.handleWebhook(payload);

    if (!result.handled) {
      const manualProvider = getPaymentProvider("manual");
      result = await manualProvider.handleWebhook(payload);
    }

    if (!result.handled || !result.paymentId) {
      return NextResponse.json({ error: "Webhook not recognized or unhandled" }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({ message: "Webhook received for unsuccessful transaction" }, { status: 200 });
    }

    const creditResult = await completePaymentAndCreditWallet(
      result.paymentId,
      result.providerRef
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
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    return NextResponse.json({ payment });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch payment" }, { status: 500 });
  }
}
