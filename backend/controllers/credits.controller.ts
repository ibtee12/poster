import { NextResponse } from "next/server";
import { prisma } from "@/backend/db/prisma";
import { getUserBalance } from "@/backend/services/credits.service";
import { UserContext } from "@/backend/middleware/auth";

export async function getBalanceController(req: Request, ctx?: UserContext) {
  const user = ctx?.user;
  if (!user) {
    return NextResponse.json({ authenticated: false, balance: 0, transactions: [] });
  }

  const balance = await getUserBalance(user.id);

  const transactions = await prisma.creditTransaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    authenticated: true,
    userId: user.id,
    email: user.email,
    balance,
    transactions,
  });
}

export async function spendDownloadController(_req: Request) {
  // Free, unrestricted clean downloads without login or credits required
  return NextResponse.json({ allowed: true, cost: 0 });
}

