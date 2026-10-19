// --- Admin Authentication (Pure Edge-compatible, Web Crypto) ---
export const AUTH_COOKIE_NAME = "poster_admin_token";
const TOKEN_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

function base64UrlEncode(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function generateAdminToken(): Promise<string> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is required");
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    role: "admin",
    iat: now,
    exp: now + TOKEN_EXPIRY_SECONDS,
  });

  const enc = new TextEncoder();
  const payloadB64 = base64UrlEncode(enc.encode(payload));

  const key = await getHmacKey(secret);
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  const sigB64 = base64UrlEncode(new Uint8Array(sigBuffer));

  return `${payloadB64}.${sigB64}`;
}

export async function getExpectedToken(): Promise<string> {
  return generateAdminToken();
}

export async function verifyAuthToken(token?: string | null): Promise<boolean> {
  if (!token || typeof token !== "string") return false;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [payloadB64, sigB64] = parts;

  try {
    const key = await getHmacKey(secret);
    const enc = new TextEncoder();
    const sigBytes = base64UrlDecode(sigB64);
    const isValidSig = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as unknown as BufferSource,
      enc.encode(payloadB64)
    );

    if (!isValidSig) return false;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson);

    if (typeof payload.exp !== "number") return false;
    const now = Math.floor(Date.now() / 1000);
    if (now > payload.exp) return false;

    return true;
  } catch {
    return false;
  }
}

export async function verifyAdminPassword(inputPassword: string): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || typeof inputPassword !== "string") return false;

  const enc = new TextEncoder();
  const hashInput = await crypto.subtle.digest("SHA-256", enc.encode(inputPassword));
  const hashTarget = await crypto.subtle.digest("SHA-256", enc.encode(adminPassword));

  const a = new Uint8Array(hashInput);
  const b = new Uint8Array(hashTarget);

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
