import { prisma } from "../db/prisma";
import { addCredits } from "./credits.service";

export interface CreatePaymentParams {
  userId: string;
  packageId: string;
  amount: number;
  currency: string;
  redirectUrl?: string;
}

export interface PaymentResult {
  paymentId: string;
  redirectUrl?: string;
  clientSecret?: string;
}

export interface VerifyResult {
  success: boolean;
  amountPaid?: number;
  providerRef?: string;
  error?: string;
}

export interface WebhookResult {
  handled: boolean;
  paymentId?: string;
  success?: boolean;
  providerRef?: string;
}

export interface PaymentProvider {
  createPayment(params: CreatePaymentParams): Promise<PaymentResult>;
  verifyPayment(paymentId: string, extraParams?: any): Promise<VerifyResult>;
  handleWebhook(payload: any, headers?: any): Promise<WebhookResult>;
}

// ============================================================================
// 1. Manual / Test Payment Provider
// ============================================================================
export class ManualPaymentProvider implements PaymentProvider {
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const payment = await prisma.payment.create({
      data: {
        userId: params.userId,
        packageId: params.packageId,
        amount: params.amount,
        currency: params.currency || "BDT",
        status: "pending",
        provider: "manual",
        providerRef: `manual_ref_${Date.now()}`,
      },
    });

    return {
      paymentId: payment.id,
      redirectUrl: `/payment/manual/${payment.id}`,
    };
  }

  async verifyPayment(paymentId: string, extraParams?: any): Promise<VerifyResult> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return { success: false, error: "Payment not found" };
    }

    // In manual test mode, admin or user verification marks it paid
    return {
      success: true,
      amountPaid: payment.amount,
      providerRef: extraParams?.providerRef || `manual_tx_${Date.now()}`,
    };
  }

  async handleWebhook(payload: any): Promise<WebhookResult> {
    const paymentId = payload?.paymentId;
    if (!paymentId) return { handled: false };

    return {
      handled: true,
      paymentId,
      success: payload.status === "paid" || payload.status === "success",
      providerRef: payload.providerRef || `webhook_ref_${Date.now()}`,
    };
  }
}

// ============================================================================
// 2. bKash Tokenized Checkout Provider (Official API v1.2.0-beta)
// ============================================================================
export class BkashPaymentProvider implements PaymentProvider {
  private baseUrl: string;
  private appKey: string;
  private appSecret: string;
  private username: string;
  private password: string;

  constructor() {
    const isSandbox = process.env.BKASH_ENV !== "live";
    this.baseUrl = isSandbox
      ? "https://tokenized.sandbox.bka.sh/v1.2.0-beta"
      : "https://tokenized.pay.bka.sh/v1.2.0-beta";

    this.appKey = process.env.BKASH_APP_KEY || "mock_bkash_app_key";
    this.appSecret = process.env.BKASH_APP_SECRET || "mock_bkash_app_secret";
    this.username = process.env.BKASH_USERNAME || "mock_bkash_username";
    this.password = process.env.BKASH_PASSWORD || "mock_bkash_password";
  }

  private async getGrantToken(): Promise<string> {
    // If running in development with mock/unconfigured credentials, return fallback mock token
    if (this.appKey.startsWith("mock_")) {
      return "mock_bkash_id_token_" + Date.now();
    }

    const res = await fetch(`${this.baseUrl}/tokenized/checkout/token/grant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        username: this.username,
        password: this.password,
      },
      body: JSON.stringify({
        app_key: this.appKey,
        app_secret: this.appSecret,
      }),
    });

    if (!res.ok) {
      throw new Error(`bKash grant token failed with status ${res.status}`);
    }

    const data = await res.json();
    return data.id_token;
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const payment = await prisma.payment.create({
      data: {
        userId: params.userId,
        packageId: params.packageId,
        amount: params.amount,
        currency: "BDT",
        status: "pending",
        provider: "bkash",
      },
    });

    // Check if live credentials present
    if (!this.appKey.startsWith("mock_")) {
      const idToken = await this.getGrantToken();

      const createRes = await fetch(`${this.baseUrl}/tokenized/checkout/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: idToken,
          "X-APP-Key": this.appKey,
        },
        body: JSON.stringify({
          mode: "0011",
          payerReference: params.userId,
          callbackURL: params.redirectUrl || `${process.env.APP_URL || "http://localhost:3000"}/api/payments/bkash/callback`,
          amount: String(params.amount),
          currency: "BDT",
          intent: "sale",
          merchantInvoiceNumber: payment.id,
        }),
      });

      const createData = await createRes.json();
      if (createData.bkashURL) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { providerRef: createData.paymentID },
        });

        return {
          paymentId: payment.id,
          redirectUrl: createData.bkashURL,
        };
      }
    }

    // Fallback/Simulated bKash checkout page
    return {
      paymentId: payment.id,
      redirectUrl: `/payment/bkash/${payment.id}`,
    };
  }

  async verifyPayment(paymentId: string, extraParams?: any): Promise<VerifyResult> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return { success: false, error: "Payment not found" };
    }

    if (this.appKey.startsWith("mock_")) {
      return {
        success: true,
        amountPaid: payment.amount,
        providerRef: `BKASH_SIM_${Date.now()}`,
      };
    }

    try {
      const idToken = await this.getGrantToken();
      const executeRes = await fetch(`${this.baseUrl}/tokenized/checkout/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: idToken,
          "X-APP-Key": this.appKey,
        },
        body: JSON.stringify({
          paymentID: extraParams?.bkashPaymentID || payment.providerRef,
        }),
      });

      const execData = await executeRes.json();
      if (execData.statusCode === "0000" && execData.transactionStatus === "Completed") {
        return {
          success: true,
          amountPaid: parseFloat(execData.amount),
          providerRef: execData.trxID,
        };
      } else {
        return {
          success: false,
          error: execData.statusMessage || "bKash payment verification failed",
        };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "bKash verification error" };
    }
  }

  async handleWebhook(payload: any): Promise<WebhookResult> {
    const paymentID = payload?.paymentID || payload?.merchantInvoiceNumber;
    if (!paymentID) return { handled: false };

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [{ id: paymentID }, { providerRef: paymentID }],
      },
    });

    if (!payment) return { handled: false };

    const isSuccess = payload.transactionStatus === "Completed" || payload.statusCode === "0000";

    return {
      handled: true,
      paymentId: payment.id,
      success: isSuccess,
      providerRef: payload.trxID || payment.providerRef || undefined,
    };
  }
}

// Factory function
export function getPaymentProvider(providerName?: string): PaymentProvider {
  const chosen = (providerName || process.env.PAYMENT_PROVIDER || "manual").toLowerCase();
  if (chosen === "bkash") {
    return new BkashPaymentProvider();
  }
  return new ManualPaymentProvider();
}

/**
 * Completes a payment and credits the user's wallet.
 * IDEMPOTENT: Guarantees that invoking this multiple times with the same paymentId
 * will NEVER credit the wallet twice.
 */
export async function completePaymentAndCreditWallet(
  paymentId: string,
  providerRef?: string
): Promise<{ success: boolean; alreadyProcessed?: boolean; error?: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { package: true },
      });

      if (!payment) {
        return { success: false, error: "Payment not found" };
      }

      // IDEMPOTENCY CHECK: if already paid, do NOT credit again
      if (payment.status === "paid") {
        return {
          success: true,
          alreadyProcessed: true,
        };
      }

      // Mark payment as paid
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: "paid",
          providerRef: providerRef || payment.providerRef,
        },
      });

      // Add credits to wallet
      const creditsToAdd = payment.package.credits;

      // Update wallet inside transaction
      await tx.wallet.upsert({
        where: { userId: payment.userId },
        update: {
          balance: { increment: creditsToAdd },
        },
        create: {
          userId: payment.userId,
          balance: creditsToAdd,
        },
      });

      // Insert credit transaction
      await tx.creditTransaction.create({
        data: {
          userId: payment.userId,
          amount: creditsToAdd,
          type: "purchase",
          reason: `Purchased ${payment.package.name} (${creditsToAdd} credits)`,
          reference: payment.id,
        },
      });

      return {
        success: true,
        alreadyProcessed: false,
      };
    });
  } catch (err: any) {
    console.error("Failed to credit payment:", err);
    return { success: false, error: err.message || "Failed to credit payment" };
  }
}
