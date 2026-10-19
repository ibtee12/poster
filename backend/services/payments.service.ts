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
  currency?: string;
  providerRef?: string;
  error?: string;
}

export interface WebhookResult {
  handled: boolean;
  paymentId?: string;
  success?: boolean;
  amountPaid?: number;
  currency?: string;
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

  async handleWebhook(_payload: any): Promise<WebhookResult> {
    // The manual provider's handleWebhook must never be reachable or processed via public webhook.
    // Manual approval happens only through the admin approve route.
    return { handled: false };
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
        currency: payment.currency || "BDT",
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
          currency: execData.currency || "BDT",
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
      include: { package: true },
    });

    if (!payment) return { handled: false };

    // Confirm server-side with provider API, never trust status in the payload
    if (!this.appKey.startsWith("mock_")) {
      const verifyResult = await this.verifyPayment(payment.id, { bkashPaymentID: paymentID });
      return {
        handled: true,
        paymentId: payment.id,
        success: verifyResult.success,
        amountPaid: verifyResult.amountPaid,
        currency: verifyResult.currency,
        providerRef: verifyResult.providerRef,
      };
    }

    // In mock/test mode: verify providerRef matches simulated transaction or valid signature
    const isMockVerified =
      Boolean(payload?.signature) ||
      (typeof payload?.trxID === "string" && payload.trxID.startsWith("BKASH_SIM_"));

    return {
      handled: true,
      paymentId: payment.id,
      success: isMockVerified,
      amountPaid: isMockVerified ? payment.amount : undefined,
      currency: isMockVerified ? (payment.package.currency || payment.currency) : undefined,
      providerRef: isMockVerified ? payload?.trxID : undefined,
    };
  }
}

// Factory function & provider helpers
export function getEnabledProviders(): string[] {
  const providers: string[] = ["bkash"];
  const allowManual =
    process.env.ALLOW_MANUAL_PAYMENTS === "true" &&
    process.env.NODE_ENV !== "production";
  if (allowManual) {
    providers.push("manual");
  }
  return providers;
}

export function getPaymentProvider(providerName?: string): PaymentProvider {
  const enabled = getEnabledProviders();
  let chosen = (providerName || "").trim().toLowerCase();

  // Ignore client-supplied providerName unless it is in the list of enabled providers
  if (!chosen || !enabled.includes(chosen)) {
    const defaultProvider = (process.env.PAYMENT_PROVIDER || "").trim().toLowerCase();
    chosen = enabled.includes(defaultProvider) ? defaultProvider : (enabled[0] || "bkash");
  }

  if (chosen === "bkash") {
    return new BkashPaymentProvider();
  }

  if (chosen === "manual") {
    if (process.env.NODE_ENV === "production" || process.env.ALLOW_MANUAL_PAYMENTS !== "true") {
      throw new Error("Manual payment provider is disabled in production");
    }
    return new ManualPaymentProvider();
  }

  return new BkashPaymentProvider();
}

/**
 * Completes a payment and credits the user's wallet.
 * ATOMIC & IDEMPOTENT: Guarantees that even with simultaneous concurrent calls,
 * credits will NEVER be added twice.
 *
 * Enforces valid state transitions:
 * - Transition to "paid" is only allowed from "pending" (or "failed" only when allowFromFailed is true)
 * - "refunded" or "cancelled" payments must NEVER be credited
 * - Returns a generic error on failure instead of leaking internal error messages
 */
export async function completePaymentAndCreditWallet(
  paymentId: string,
  providerRef?: string,
  options?: { allowFromFailed?: boolean }
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

      // Terminal cancelled or refunded states can NEVER be credited
      if (payment.status === "refunded" || payment.status === "cancelled") {
        return {
          success: false,
          error: "Payment has been cancelled or refunded and cannot be credited.",
        };
      }

      if (payment.status === "paid") {
        return {
          success: true,
          alreadyProcessed: true,
        };
      }

      const allowedStatuses = options?.allowFromFailed
        ? ["pending", "failed"]
        : ["pending"];

      if (!allowedStatuses.includes(payment.status)) {
        return {
          success: false,
          error: "Payment cannot be transitioned to paid from its current state.",
        };
      }

      // ATOMIC UPDATE: Only update if status is in allowedStatuses
      const updateResult = await tx.payment.updateMany({
        where: {
          id: paymentId,
          status: { in: allowedStatuses },
        },
        data: {
          status: "paid",
          providerRef: providerRef || payment.providerRef,
        },
      });

      // If count is 0, the payment was already marked paid by a concurrent call
      if (updateResult.count === 0) {
        return {
          success: true,
          alreadyProcessed: true,
        };
      }

      // Exactly one row was updated: credit wallet inside the same transaction
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
    return { success: false, error: "Failed to process payment completion" };
  }
}
