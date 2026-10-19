// --- Admin Authentication (Pure Edge-compatible, no Prisma / bcrypt) ---
export const AUTH_COOKIE_NAME = "poster_admin_token";

export async function getExpectedToken(): Promise<string> {
  const secret = process.env.ADMIN_PASSWORD || "admin123";
  const encoder = new TextEncoder();
  const data = encoder.encode(secret + "_poster_maker_salt_key");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyAuthToken(token?: string | null): Promise<boolean> {
  if (!token) return false;
  const expected = await getExpectedToken();
  return token === expected;
}
