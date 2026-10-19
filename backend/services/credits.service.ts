import { prisma } from "../db/prisma";

export interface TransactionResult {
  success: boolean;
  newBalance?: number;
  transactionId?: string;
  error?: string;
}

/**
 * Gets or initializes a wallet for a user.
 */
export async function getOrCreateWallet(userId: string) {
  const existing = await prisma.wallet.findUnique({
    where: { userId },
  });

  if (existing) return existing;

  // Check if signup bonus credits configured
  const settings = await getSystemSettings();
  const initialCredits = settings.freeSignupCredits || 0;

  return await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.create({
      data: {
        userId,
        balance: initialCredits,
      },
    });

    if (initialCredits > 0) {
      await tx.creditTransaction.create({
        data: {
          userId,
          amount: initialCredits,
          type: "bonus",
          reason: "Welcome signup bonus",
          reference: "signup_bonus",
        },
      });
    }

    return wallet;
  });
}

/**
 * Returns current credit balance for a user.
 */
export async function getUserBalance(userId: string): Promise<number> {
  const wallet = await getOrCreateWallet(userId);
  return wallet.balance;
}

/**
 * Adds credits to a user's wallet inside an atomic database transaction.
 */
export async function addCredits(
  userId: string,
  amount: number,
  type: "purchase" | "refund" | "bonus",
  reason: string,
  reference?: string
): Promise<TransactionResult> {
  if (amount <= 0) {
    return { success: false, error: "Amount must be greater than zero" };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Ensure wallet exists
      const wallet = await tx.wallet.upsert({
        where: { userId },
        update: {
          balance: { increment: amount },
        },
        create: {
          userId,
          balance: amount,
        },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          type,
          reason,
          reference: reference || null,
        },
      });

      return {
        success: true,
        newBalance: wallet.balance,
        transactionId: transaction.id,
      };
    });
  } catch (err: any) {
    console.error("Failed to add credits:", err);
    return { success: false, error: err.message || "Failed to add credits" };
  }
}

/**
 * Deducts credits from a user's wallet inside an atomic database transaction.
 * Guarantees balance never drops below zero and prevents double-spending.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  reason: string,
  reference?: string
): Promise<TransactionResult> {
  if (amount <= 0) {
    // Zero-cost deduction is a no-op
    const bal = await getUserBalance(userId);
    return { success: true, newBalance: bal };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
      });

      if (!wallet || wallet.balance < amount) {
        throw new Error("Insufficient credit balance. Please purchase credits to continue.");
      }

      const updated = await tx.wallet.update({
        where: { userId },
        data: {
          balance: { decrement: amount },
        },
      });

      const transaction = await tx.creditTransaction.create({
        data: {
          userId,
          amount: -amount,
          type: "spend",
          reason,
          reference: reference || null,
        },
      });

      return {
        success: true,
        newBalance: updated.balance,
        transactionId: transaction.id,
      };
    });
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Credit deduction failed",
    };
  }
}

/**
 * Checks if user has exceeded their daily spending cap.
 */
export async function checkDailySpendingCap(
  userId: string,
  additionalAmount: number
): Promise<{ allowed: boolean; currentSpent: number; cap: number }> {
  const settings = await getSystemSettings();
  const cap = settings.dailySpendingCapPerUser;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const spends = await prisma.creditTransaction.findMany({
    where: {
      userId,
      type: "spend",
      createdAt: { gte: oneDayAgo },
    },
    select: { amount: true },
  });

  const totalSpent = spends.reduce((sum, item) => sum + Math.abs(item.amount), 0);

  if (totalSpent + additionalAmount > cap) {
    return { allowed: false, currentSpent: totalSpent, cap };
  }

  return { allowed: true, currentSpent: totalSpent, cap };
}

/**
 * Retrieves the global system settings.
 */
export async function getSystemSettings() {
  let settings = await prisma.systemSetting.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    settings = await prisma.systemSetting.create({
      data: {
        id: "default",
        cleanDownloadCreditCost: 0,
        poseGenerationCreditCost: 10,
        freeSignupCredits: 0,
        dailySpendingCapPerUser: 100,
        aiKillSwitch: false,
      },
    });
  }

  return settings;
}

/**
 * Updates the global system settings.
 */
export async function updateSystemSettings(updates: {
  cleanDownloadCreditCost?: number;
  poseGenerationCreditCost?: number;
  freeSignupCredits?: number;
  dailySpendingCapPerUser?: number;
  aiKillSwitch?: boolean;
}) {
  return await prisma.systemSetting.upsert({
    where: { id: "default" },
    update: updates,
    create: {
      id: "default",
      ...updates,
    },
  });
}
