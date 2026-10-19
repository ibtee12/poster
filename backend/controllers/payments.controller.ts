import { NextResponse } from "next/server";
import { prisma } from "@/backend/db/prisma";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "@/backend/common/errors";
import {
  getPaymentProvider,
  getEnabledProviders,
  completePaymentAndCreditWallet,
} from "@/backend/services/payments.service";
import { getUserBalance } from "@/backend/services/credits.service";

export async function createPaymentController(req: Request, ctx?: any) {
  const user = ctx?.user;
  const body = ctx?.validated?.body || (await req.json());
  const { packageId, providerName } = body;

  if (!packageId) {
    throw new BadRequestError("packageId is required");
  }

  if (providerName) {
    const enabled = getEnabledProviders();
    if (!enabled.includes(String(providerName).toLowerCase())) {
      throw new BadRequestError(`Payment provider '${providerName}' is not available.`);
    }
  }

  const pkg = await prisma.package.findUnique({
    where: { id: packageId },
  });

  if (!pkg || !pkg.active) {
    throw new NotFoundError("Package not found or inactive");
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
}

export async function verifyPaymentController(req: Request, ctx?: any) {
  const user = ctx?.user;
  const isAdmin = ctx?.isAdmin;

  const body = ctx?.validated?.body || (await req.json());
  const { paymentId, extraParams } = body;

  if (!paymentId) {
    throw new BadRequestError("paymentId is required");
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { package: true },
  });

  if (!payment) {
    throw new NotFoundError("Payment not found");
  }

  // A non-owner must never be able to change a payment's status (admin can access all)
  if (!isAdmin && payment.userId !== user?.id) {
    throw new ForbiddenError("Forbidden. You do not own this payment.");
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
}

export async function webhookController(req: Request) {
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
}

export async function getPaymentByIdController(req: Request, ctx?: any) {
  const user = ctx?.user;
  const isAdmin = ctx?.isAdmin;

  const resolvedParams = ctx?.params ? await ctx.params : {};
  const id = resolvedParams.id;

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
    throw new NotFoundError("Payment not found");
  }

  // Must be owner or admin
  if (!isAdmin && payment.userId !== user?.id) {
    throw new NotFoundError("Payment not found");
  }

  // getPaymentById must not return the user's email to non-admins
  const sanitizedPayment = {
    ...payment,
    user: isAdmin ? payment.user : { id: payment.userId },
  };

  return NextResponse.json({ payment: sanitizedPayment });
}
