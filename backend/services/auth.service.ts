import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma";
import { USER_COOKIE_NAME } from "../config/constants";
import { ValidationError, UnauthorizedError } from "../common/errors";
import { getOrCreateWallet } from "./credits.service";
import type { LoginInput, SignupInput } from "../schemas/auth.schema";

// --- Admin Authentication (Re-exported from edge-compatible adminAuth) ---
export { AUTH_COOKIE_NAME, getExpectedToken, verifyAuthToken } from "../middleware/adminAuth";
export { USER_COOKIE_NAME };

const SESSION_SECRET = process.env.SESSION_SECRET || "poster_maker_secret_session_key_2026";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface SessionPayload {
  userId: string;
  email: string;
  exp: number;
}

/**
 * Creates an HMAC-SHA256 signed session token for the user.
 */
export async function createSessionToken(userId: string, email: string): Promise<string> {
  const payload: SessionPayload = {
    userId,
    email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 days
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString("base64url");

  const encoder = new TextEncoder();
  const keyData = encoder.encode(SESSION_SECRET);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(payloadB64)
  );
  const sigB64 = Buffer.from(signature).toString("base64url");

  return `${payloadB64}.${sigB64}`;
}

/**
 * Verifies an HMAC-SHA256 signed session token and returns the payload if valid.
 */
export async function verifySessionToken(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadB64, sigB64] = parts;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(SESSION_SECRET);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBuffer = Buffer.from(sigB64, "base64url");
    const isValid = await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      sigBuffer,
      encoder.encode(payloadB64)
    );

    if (!isValid) return null;

    const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload: SessionPayload = JSON.parse(payloadStr);

    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Verifies token and fetches user from DB. Plain data only, no Next.js HTTP dependencies.
 */
export async function getUserFromToken(token?: string | null): Promise<{ id: string; email: string } | null> {
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true },
  });

  return user;
}

/**
 * Backwards compatibility helper for unmigrated code accepting a Request or token.
 */
export async function getCurrentUser(reqOrToken?: Request | string | null): Promise<{ id: string; email: string } | null> {
  if (typeof reqOrToken === "string") {
    return getUserFromToken(reqOrToken);
  }
  if (reqOrToken && typeof reqOrToken === "object" && "headers" in reqOrToken) {
    const cookieHeader = reqOrToken.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${USER_COOKIE_NAME}=`));
      if (match) {
        return getUserFromToken(match.split("=")[1]);
      }
    }
    return null;
  }
  return null;
}

export async function login({ email, password }: LoginInput) {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new UnauthorizedError("Invalid email or password.");
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError("Invalid email or password.");
  }

  const token = await createSessionToken(user.id, user.email);

  return {
    user: { id: user.id, email: user.email },
    token,
  };
}

export async function signup({ email, password }: SignupInput) {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw new ValidationError("An account with this email already exists. Please log in.");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
    },
  });

  await getOrCreateWallet(user.id);
  const token = await createSessionToken(user.id, user.email);

  return {
    user,
    token,
  };
}
