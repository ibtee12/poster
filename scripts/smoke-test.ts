import fs from "fs";
import path from "path";
import crypto from "crypto";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const BASELINE_PATH = path.join(__dirname, "baseline.json");

// Generate unique IP per test runner invocation to avoid rate limit collisions across test runs
const TEST_RUN_IP = "127.0.0." + ((Math.floor(Date.now() / 1000) % 200) + 10);
const originalFetch = globalThis.fetch;
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  if (!headers.has("x-forwarded-for")) {
    headers.set("x-forwarded-for", TEST_RUN_IP);
  }
  return originalFetch(input, { ...init, headers });
};

export interface EndpointResult {
  name: string;
  method: string;
  url: string;
  statusCode: number;
  keys: string[];
  errorMessage?: string;
  cookies?: Record<string, string>;
}

function extractKeys(obj: any): string[] {
  if (!obj || typeof obj !== "object") return [];
  if (Array.isArray(obj)) {
    if (obj.length === 0) return ["[]"];
    return [`Array<${extractKeys(obj[0]).join(",")}>`];
  }
  return Object.keys(obj).sort();
}

function parseSetCookie(header: string | null): Record<string, string> {
  if (!header) return {};
  const attrs: Record<string, string> = {};
  const parts = header.split(";").map((p) => p.trim());
  if (parts.length > 0) {
    const [name, val] = parts[0].split("=");
    attrs["name"] = name;
    attrs["hasValue"] = val ? "true" : "false";
  }
  for (let i = 1; i < parts.length; i++) {
    const [k, v] = parts[i].split("=");
    const key = k.toLowerCase();
    attrs[key] = v !== undefined ? v.toLowerCase() : "true";
  }
  return attrs;
}

async function runSmokeTest(): Promise<EndpointResult[]> {
  const results: EndpointResult[] = [];
  let adminCookie = "";
  let userCookie = "";
  let createdTemplateId = "";
  let duplicatedTemplateId = "";
  let createdPackageId = "";
  let createdPaymentId = "";
  let createdPoseId = "";
  let createdJobId = "";
  let createdPosterId = "";
  let duplicatedPosterId = "";
  let createdReportId = "";

  const record = (
    name: string,
    method: string,
    url: string,
    status: number,
    body: any,
    res?: Response
  ) => {
    const keys = extractKeys(body);
    const errorMessage = typeof body?.error === "string" ? body.error : undefined;
    let cookieAttrs: Record<string, string> | undefined;
    if (res) {
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) {
        cookieAttrs = parseSetCookie(setCookie);
      }
    }

    results.push({
      name,
      method,
      url,
      statusCode: status,
      keys,
      ...(errorMessage ? { errorMessage } : {}),
      ...(cookieAttrs ? { cookies: cookieAttrs } : {}),
    });

    const mark = status >= 200 && status < 300 ? "✓" : status < 400 ? "→" : "⨯";
    const extra = errorMessage ? ` [err: ${errorMessage}]` : cookieAttrs ? ` [cookie: ${cookieAttrs.name}]` : "";
    console.log(`  ${mark} [${status}] ${method.padEnd(6)} ${url.padEnd(45)} (${keys.slice(0, 5).join(", ")})${extra}`);
  };

  console.log(`\nStarting Smoke Test against ${BASE_URL}...\n`);

  // 1. Public Settings
  {
    const res = await fetch(`${BASE_URL}/api/settings`);
    const data = await res.json().catch(() => ({}));
    record("settings.public", "GET", "/api/settings", res.status, data);
  }

  // 2. Admin Login
  {
    const res = await fetch(`${BASE_URL}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || "admin123" }),
    });
    const setCookie = res.headers.get("set-cookie") || "";
    const match = setCookie.match(/poster_admin_token=([^;]+)/);
    if (match) adminCookie = `poster_admin_token=${match[1]}`;
    const data = await res.json().catch(() => ({}));
    record("admin.login", "POST", "/api/admin/login", res.status, data, res);
  }

  // 2b. Admin Auth Failure: Cookie forged with old formula (SHA-256 of password + salt)
  {
    const oldForgedToken = crypto
      .createHash("sha256")
      .update((process.env.ADMIN_PASSWORD || "admin123") + "_poster_maker_salt_key")
      .digest("hex");
    const res = await fetch(`${BASE_URL}/api/admin/settings`, {
      headers: { Cookie: `poster_admin_token=${oldForgedToken}` },
    });
    const data = await res.json().catch(() => ({}));
    record("admin.settings.old_forged_cookie", "GET", "/api/admin/settings", res.status, data);
  }

  const adminHeaders: Record<string, string> = adminCookie ? { Cookie: adminCookie } : {};

  // 3. Admin Settings GET & POST
  {
    const res = await fetch(`${BASE_URL}/api/admin/settings`, { headers: adminHeaders });
    const data = await res.json().catch(() => ({}));
    record("admin.settings.get", "GET", "/api/admin/settings", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/admin/settings`, {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ cleanDownloadCreditCost: 0, poseGenerationCreditCost: 10 }),
    });
    const data = await res.json().catch(() => ({}));
    record("admin.settings.post", "POST", "/api/admin/settings", res.status, data);
  }

  // 4. Templates List
  {
    const res = await fetch(`${BASE_URL}/api/templates`);
    const data = await res.json().catch(() => ({}));
    record("templates.list", "GET", "/api/templates", res.status, data);
  }

  // 5. Admin Template Create
  {
    const formData = new FormData();
    formData.append(
      "config",
      JSON.stringify({
        schemaVersion: 2,
        name: "Smoke Test Template",
        category: "Smoke",
        tags: ["smoke"],
        width: 1200,
        height: 1600,
        styles: [],
        layouts: [
          {
            id: "default",
            name: "Default",
            width: 1200,
            height: 1600,
            blank: "blank.png",
            slots: [
              {
                id: "slot1",
                type: "text",
                label: "Title",
                x: 0.1,
                y: 0.1,
                w: 0.8,
                h: 0.1,
                fontSize: 32,
                color: "#ffffff",
                align: "center",
              },
            ],
          },
        ],
      })
    );
    const dummyBlob = new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64")], {
      type: "image/png",
    });
    formData.append("blank.png", dummyBlob, "blank.png");

    const res = await fetch(`${BASE_URL}/api/admin/templates`, {
      method: "POST",
      headers: adminHeaders,
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    createdTemplateId = data.id || "";
    record("admin.templates.create", "POST", "/api/admin/templates", res.status, data);
  }

  // 6. Template Get by ID
  if (createdTemplateId) {
    const res = await fetch(`${BASE_URL}/api/templates/${createdTemplateId}`);
    const data = await res.json().catch(() => ({}));
    record("templates.get", "GET", `/api/templates/${createdTemplateId}`, res.status, data);
  }

  // 7. Admin Template Duplicate Failures & Normal
  if (createdTemplateId) {
    const res = await fetch(`${BASE_URL}/api/admin/templates/${createdTemplateId}/duplicate`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    record("admin.templates.duplicate.no_cookie", "POST", `/api/admin/templates/${createdTemplateId}/duplicate`, res.status, data);
  }
  if (createdTemplateId) {
    const res = await fetch(`${BASE_URL}/api/admin/templates/${createdTemplateId}/duplicate`, {
      method: "POST",
      headers: adminHeaders,
    });
    const data = await res.json().catch(() => ({}));
    duplicatedTemplateId = data.id || "";
    record("admin.templates.duplicate", "POST", `/api/admin/templates/${createdTemplateId}/duplicate`, res.status, data);
  }

  // 8. Admin Template Delete Failures & Normal (Clean up duplicate)
  if (duplicatedTemplateId) {
    const res = await fetch(`${BASE_URL}/api/admin/templates/${duplicatedTemplateId}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    record("admin.templates.delete.no_cookie", "DELETE", `/api/admin/templates/${duplicatedTemplateId}`, res.status, data);
  }
  if (duplicatedTemplateId) {
    const res = await fetch(`${BASE_URL}/api/admin/templates/${duplicatedTemplateId}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    const data = await res.json().catch(() => ({}));
    record("admin.templates.delete", "DELETE", `/api/admin/templates/${duplicatedTemplateId}`, res.status, data);
  }

  // 9. Auth Signup & Failure Cases
  // 9a. Signup missing fields
  {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    record("auth.signup.missing_fields", "POST", "/api/auth/signup", res.status, data);
  }

  // 9b. Signup invalid email (missing @)
  {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalidemailwithoutat", password: "password123" }),
    });
    const data = await res.json().catch(() => ({}));
    record("auth.signup.invalid_email", "POST", "/api/auth/signup", res.status, data);
  }

  // 9c. Signup short password (< 6 chars)
  {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "valid_short_pw@test.com", password: "123" }),
    });
    const data = await res.json().catch(() => ({}));
    record("auth.signup.short_password", "POST", "/api/auth/signup", res.status, data);
  }

  // 9d. Signup success
  const testEmail = `smoke_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
  {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: "password123" }),
    });
    const setCookie = res.headers.get("set-cookie") || "";
    const match = setCookie.match(/poster_user_token=([^;]+)/);
    if (match) userCookie = `poster_user_token=${match[1]}`;
    const data = await res.json().catch(() => ({}));
    record("auth.signup", "POST", "/api/auth/signup", res.status, data, res);
  }

  // 9e. Signup duplicate email
  {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: "password123" }),
    });
    const data = await res.json().catch(() => ({}));
    record("auth.signup.duplicate", "POST", "/api/auth/signup", res.status, data);
  }

  // 10. Auth Me Checks
  // 10a. Me with no cookie
  {
    const res = await fetch(`${BASE_URL}/api/auth/me`);
    const data = await res.json().catch(() => ({}));
    record("auth.me.no_cookie", "GET", "/api/auth/me", res.status, data);
  }

  // 10b. Me with invalid cookie
  {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: "poster_user_token=invalid.token.signature" },
    });
    const data = await res.json().catch(() => ({}));
    record("auth.me.invalid_cookie", "GET", "/api/auth/me", res.status, data);
  }

  const userHeaders: Record<string, string> = userCookie ? { Cookie: userCookie } : {};

  // 10c. Me authenticated
  {
    const res = await fetch(`${BASE_URL}/api/auth/me`, { headers: userHeaders });
    const data = await res.json().catch(() => ({}));
    record("auth.me", "GET", "/api/auth/me", res.status, data);
  }

  // 11. Auth Login Checks
  // 11a. Login missing fields
  {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    record("auth.login.missing_fields", "POST", "/api/auth/login", res.status, data);
  }

  // 11b. Login unknown email
  {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "unknown_smoke_user_99999@test.com", password: "password123" }),
    });
    const data = await res.json().catch(() => ({}));
    record("auth.login.unknown_email", "POST", "/api/auth/login", res.status, data);
  }

  // 11c. Login wrong password
  {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: "wrong_password_123" }),
    });
    const data = await res.json().catch(() => ({}));
    record("auth.login.wrong_password", "POST", "/api/auth/login", res.status, data);
  }

  // 11d. Login success
  {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: "password123" }),
    });
    const data = await res.json().catch(() => ({}));
    record("auth.login", "POST", "/api/auth/login", res.status, data, res);
  }

  // 11b. User 2 Signup (for cross-user security smoke tests)
  let user2Cookie = "";
  const user2Email = `smoke_user2_${Date.now()}@example.com`;
  {
    const res = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user2Email, password: "password123" }),
    });
    const setCookie = res.headers.get("set-cookie") || "";
    const match = setCookie.match(/poster_user_token=([^;]+)/);
    if (match) user2Cookie = `poster_user_token=${match[1]}`;
    const data = await res.json().catch(() => ({}));
    record("auth.signup.user2", "POST", "/api/auth/signup", res.status, data, res);
  }
  const user2Headers: Record<string, string> = user2Cookie ? { Cookie: user2Cookie } : {};

  // 12. Credits Balance & Spend
  {
    const res = await fetch(`${BASE_URL}/api/credits/balance`, { headers: userHeaders });
    const data = await res.json().catch(() => ({}));
    record("credits.balance", "GET", "/api/credits/balance", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/credits/spend-download`, {
      method: "POST",
      headers: { ...userHeaders, "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    record("credits.spendDownload", "POST", "/api/credits/spend-download", res.status, data);
  }

  // 13. Admin Credits Adjust
  {
    const res = await fetch(`${BASE_URL}/api/admin/credits/adjust`, {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, amount: 50, reason: "Smoke test adjustment" }),
    });
    const data = await res.json().catch(() => ({}));
    record("admin.credits.adjust", "POST", "/api/admin/credits/adjust", res.status, data);
  }

  // 14. Packages: List, Admin Create, Admin Patch
  {
    const res = await fetch(`${BASE_URL}/api/packages`);
    const data = await res.json().catch(() => ({}));
    record("packages.list", "GET", "/api/packages", res.status, data);
  }

  // 14a. Packages Admin Auth Failure Cases
  {
    const res = await fetch(`${BASE_URL}/api/admin/packages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Pkg", credits: 10, price: 100 }),
    });
    const data = await res.json().catch(() => ({}));
    record("admin.packages.create.no_cookie", "POST", "/api/admin/packages", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/admin/packages`, {
      method: "POST",
      headers: { Cookie: "poster_admin_token=invalid_token", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Pkg", credits: 10, price: 100 }),
    });
    const data = await res.json().catch(() => ({}));
    record("admin.packages.create.invalid_cookie", "POST", "/api/admin/packages", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/admin/packages`, {
      method: "POST",
      headers: { ...userHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Pkg", credits: 10, price: 100 }),
    });
    const data = await res.json().catch(() => ({}));
    record("admin.packages.create.user_cookie", "POST", "/api/admin/packages", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/admin/packages`, {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    record("admin.packages.create.missing_fields", "POST", "/api/admin/packages", res.status, data);
  }

  // 14b. Packages Admin Normal Create
  {
    const res = await fetch(`${BASE_URL}/api/admin/packages`, {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Smoke Test Package",
        credits: 100,
        price: 999,
        badge: "TEST",
      }),
    });
    const data = await res.json().catch(() => ({}));
    createdPackageId = data.package?.id || "";
    record("admin.packages.create", "POST", "/api/admin/packages", res.status, data);
  }
  if (createdPackageId) {
    // 14c. Packages Admin Patch Auth Failures
    {
      const res = await fetch(`${BASE_URL}/api/admin/packages/${createdPackageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: 1099 }),
      });
      const data = await res.json().catch(() => ({}));
      record("admin.packages.patch.no_cookie", "PATCH", `/api/admin/packages/${createdPackageId}`, res.status, data);
    }
    {
      const res = await fetch(`${BASE_URL}/api/admin/packages/${createdPackageId}`, {
        method: "PATCH",
        headers: { Cookie: "poster_admin_token=invalid_token", "Content-Type": "application/json" },
        body: JSON.stringify({ price: 1099 }),
      });
      const data = await res.json().catch(() => ({}));
      record("admin.packages.patch.invalid_cookie", "PATCH", `/api/admin/packages/${createdPackageId}`, res.status, data);
    }
    {
      const res = await fetch(`${BASE_URL}/api/admin/packages/${createdPackageId}`, {
        method: "PATCH",
        headers: { ...userHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ price: 1099 }),
      });
      const data = await res.json().catch(() => ({}));
      record("admin.packages.patch.user_cookie", "PATCH", `/api/admin/packages/${createdPackageId}`, res.status, data);
    }

    // 14d-1. Packages Admin Patch Invalid Credits ("abc")
    {
      const res = await fetch(`${BASE_URL}/api/admin/packages/${createdPackageId}`, {
        method: "PATCH",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ credits: "abc" }),
      });
      const data = await res.json().catch(() => ({}));
      record("admin.packages.patch.invalid_credits", "PATCH", `/api/admin/packages/${createdPackageId}`, res.status, data);
    }

    // 14d-2. Packages Admin Patch Negative Price (-10)
    {
      const res = await fetch(`${BASE_URL}/api/admin/packages/${createdPackageId}`, {
        method: "PATCH",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ price: -10 }),
      });
      const data = await res.json().catch(() => ({}));
      record("admin.packages.patch.negative_price", "PATCH", `/api/admin/packages/${createdPackageId}`, res.status, data);
    }

    // 14d-3. Packages Admin Normal Patch
    const res = await fetch(`${BASE_URL}/api/admin/packages/${createdPackageId}`, {
      method: "PATCH",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ price: 1099 }),
    });
    const data = await res.json().catch(() => ({}));
    record("admin.packages.patch", "PATCH", `/api/admin/packages/${createdPackageId}`, res.status, data);
  }

  // 15. Payments Security & Normal Flows
  // 15a. Client cannot select disabled manual provider
  {
    const res = await fetch(`${BASE_URL}/api/payments/create`, {
      method: "POST",
      headers: { ...userHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ packageId: createdPackageId, providerName: "manual" }),
    });
    const data = await res.json().catch(() => ({}));
    record("payments.create.manual_in_production", "POST", "/api/payments/create", res.status, data);
  }

  // 15b. Create Normal Payment
  {
    const res = await fetch(`${BASE_URL}/api/payments/create`, {
      method: "POST",
      headers: { ...userHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ packageId: createdPackageId }),
    });
    const data = await res.json().catch(() => ({}));
    createdPaymentId = data.paymentId || "";
    record("payments.create", "POST", "/api/payments/create", res.status, data);
  }

  // 15c. Second User cannot read First User's payment
  if (createdPaymentId) {
    const res = await fetch(`${BASE_URL}/api/payments/${createdPaymentId}`, { headers: user2Headers });
    const data = await res.json().catch(() => ({}));
    record("payments.get.second_user", "GET", `/api/payments/${createdPaymentId}`, res.status, data);
  }

  // 15d. Normal Get Payment (Owner)
  if (createdPaymentId) {
    const res = await fetch(`${BASE_URL}/api/payments/${createdPaymentId}`, { headers: userHeaders });
    const data = await res.json().catch(() => ({}));
    record("payments.get", "GET", `/api/payments/${createdPaymentId}`, res.status, data);
  }

  // 15e. Second User cannot verify First User's payment
  if (createdPaymentId) {
    const res = await fetch(`${BASE_URL}/api/payments/verify`, {
      method: "POST",
      headers: { ...user2Headers, "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: createdPaymentId }),
    });
    const data = await res.json().catch(() => ({}));
    record("payments.verify.second_user", "POST", "/api/payments/verify", res.status, data);
  }

  // 15f. Normal Verify Payment (Owner)
  if (createdPaymentId) {
    const res = await fetch(`${BASE_URL}/api/payments/verify`, {
      method: "POST",
      headers: { ...userHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: createdPaymentId }),
    });
    const data = await res.json().catch(() => ({}));
    record("payments.verify", "POST", "/api/payments/verify", res.status, data);
  }

  // 15g. Forged Public Webhook is rejected and leaves balance unchanged
  if (createdPaymentId) {
    const res = await fetch(`${BASE_URL}/api/payments/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: createdPaymentId, status: "paid" }),
    });
    const data = await res.json().catch(() => ({}));
    record("payments.webhook.forged", "POST", "/api/payments/webhook", res.status, data);
  }

  {
    const res = await fetch(`${BASE_URL}/api/admin/payments`, { headers: adminHeaders });
    const data = await res.json().catch(() => ({}));
    record("admin.payments.list", "GET", "/api/admin/payments", res.status, data);
  }
  if (createdPaymentId) {
    const res = await fetch(`${BASE_URL}/api/admin/payments/approve`, {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: createdPaymentId, note: "Smoke test approved" }),
    });
    const data = await res.json().catch(() => ({}));
    record("admin.payments.approve", "POST", "/api/admin/payments/approve", res.status, data);
  }

  // Clean up Package
  if (createdPackageId) {
    {
      const res = await fetch(`${BASE_URL}/api/admin/packages/${createdPackageId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      record("admin.packages.delete.no_cookie", "DELETE", `/api/admin/packages/${createdPackageId}`, res.status, data);
    }
    {
      const res = await fetch(`${BASE_URL}/api/admin/packages/${createdPackageId}`, {
        method: "DELETE",
        headers: { Cookie: "poster_admin_token=invalid_token" },
      });
      const data = await res.json().catch(() => ({}));
      record("admin.packages.delete.invalid_cookie", "DELETE", `/api/admin/packages/${createdPackageId}`, res.status, data);
    }
    {
      const res = await fetch(`${BASE_URL}/api/admin/packages/${createdPackageId}`, {
        method: "DELETE",
        headers: userHeaders,
      });
      const data = await res.json().catch(() => ({}));
      record("admin.packages.delete.user_cookie", "DELETE", `/api/admin/packages/${createdPackageId}`, res.status, data);
    }

    const res = await fetch(`${BASE_URL}/api/admin/packages/${createdPackageId}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    const data = await res.json().catch(() => ({}));
    record("admin.packages.delete", "DELETE", `/api/admin/packages/${createdPackageId}`, res.status, data);
  }

  // 16. Poses: List, Admin Create, Admin Patch, Generate, Job Status, Delete
  {
    const res = await fetch(`${BASE_URL}/api/poses`);
    const data = await res.json().catch(() => ({}));
    record("poses.list", "GET", "/api/poses", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/poses`, {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Smoke Test Pose",
        gender: "unisex",
        previewImage: "/sample-photo.jpg",
        prompt: "A handsome model posing cleanly",
      }),
    });
    const data = await res.json().catch(() => ({}));
    createdPoseId = data.pose?.id || "";
    record("admin.poses.create", "POST", "/api/poses", res.status, data);
  }
  if (createdPoseId) {
    const res = await fetch(`${BASE_URL}/api/poses/${createdPoseId}`, {
      method: "PATCH",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Smoke Test Pose Updated" }),
    });
    const data = await res.json().catch(() => ({}));
    record("admin.poses.patch", "PATCH", `/api/poses/${createdPoseId}`, res.status, data);
  }
  if (createdPoseId) {
    const res = await fetch(`${BASE_URL}/api/poses/generate`, {
      method: "POST",
      headers: { ...userHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        poseId: createdPoseId,
        photoBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        prompt: "Smoke test pose prompt",
        mockProvider: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    createdJobId = data.jobId || "";
    record("poses.generate", "POST", "/api/poses/generate", res.status, data);
  }
  if (createdJobId) {
    const res = await fetch(`${BASE_URL}/api/poses/jobs/${createdJobId}`, { headers: userHeaders });
    const data = await res.json().catch(() => ({}));
    record("poses.jobStatus", "GET", `/api/poses/jobs/${createdJobId}`, res.status, data);

    // Cross-user privacy: Second user cannot read first user's job status
    const res2 = await fetch(`${BASE_URL}/api/poses/jobs/${createdJobId}`, { headers: user2Headers });
    const data2 = await res2.json().catch(() => ({}));
    record("poses.jobStatus.second_user", "GET", `/api/poses/jobs/${createdJobId}`, res2.status, data2);

    // Cross-user privacy: Second user cannot access first user's pose output file
    const fileRes = await fetch(`${BASE_URL}/api/posters/files/poses/outputs/${createdJobId}.png`, { headers: user2Headers });
    const fileData = await fileRes.json().catch(() => ({}));
    record("poses.files.output_second_user", "GET", `/api/posters/files/poses/outputs/${createdJobId}.png`, fileRes.status, fileData);
  }
  if (createdPoseId) {
    const res = await fetch(`${BASE_URL}/api/poses/${createdPoseId}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    const data = await res.json().catch(() => ({}));
    record("admin.poses.delete", "DELETE", `/api/poses/${createdPoseId}`, res.status, data);
  }

  // 17. Posters: Create, List, Get, Duplicate, Delete Duplicate, Delete Original
  {
    const res = await fetch(`${BASE_URL}/api/posters`, {
      method: "POST",
      headers: { ...userHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: createdTemplateId || "template_sample",
        name: "My Smoke Poster",
        aspectRatio: "3:4",
        canvasData: { layers: [] },
      }),
    });
    const data = await res.json().catch(() => ({}));
    createdPosterId = data.poster?.id || "";
    record("posters.create", "POST", "/api/posters", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/posters`, { headers: userHeaders });
    const data = await res.json().catch(() => ({}));
    record("posters.list", "GET", "/api/posters", res.status, data);
  }
  if (createdPosterId) {
    const res = await fetch(`${BASE_URL}/api/posters/${createdPosterId}`, { headers: userHeaders });
    const data = await res.json().catch(() => ({}));
    record("posters.get", "GET", `/api/posters/${createdPosterId}`, res.status, data);

    // Cross-user privacy: Second user cannot read first user's poster
    const res2 = await fetch(`${BASE_URL}/api/posters/${createdPosterId}`, { headers: user2Headers });
    const data2 = await res2.json().catch(() => ({}));
    record("posters.get.second_user", "GET", `/api/posters/${createdPosterId}`, res2.status, data2);

    // Cross-user privacy: Second user cannot access first user's poster file
    const fileRes = await fetch(`${BASE_URL}/api/posters/files/${createdPosterId}/preview.png`, { headers: user2Headers });
    const fileData = await fileRes.json().catch(() => ({}));
    record("posters.files.second_user", "GET", `/api/posters/files/${createdPosterId}/preview.png`, fileRes.status, fileData);
  }
  if (createdPosterId) {
    const res = await fetch(`${BASE_URL}/api/posters/${createdPosterId}/duplicate`, {
      method: "POST",
      headers: userHeaders,
    });
    const data = await res.json().catch(() => ({}));
    duplicatedPosterId = data.poster?.id || "";
    record("posters.duplicate", "POST", `/api/posters/${createdPosterId}/duplicate`, res.status, data);
  }
  if (duplicatedPosterId) {
    const res = await fetch(`${BASE_URL}/api/posters/${duplicatedPosterId}`, {
      method: "DELETE",
      headers: userHeaders,
    });
    const data = await res.json().catch(() => ({}));
    record("posters.deleteDuplicate", "DELETE", `/api/posters/${duplicatedPosterId}`, res.status, data);
  }
  if (createdPosterId) {
    const res = await fetch(`${BASE_URL}/api/posters/${createdPosterId}`, {
      method: "DELETE",
      headers: userHeaders,
    });
    const data = await res.json().catch(() => ({}));
    record("posters.deleteOriginal", "DELETE", `/api/posters/${createdPosterId}`, res.status, data);
  }

  // 18. Reports: Submit, Admin List, Admin Resolve
  // 18a. Submit Report Validation Failures
  {
    const res = await fetch(`${BASE_URL}/api/reports`, {
      method: "POST",
      headers: { ...userHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ posterId: "some_id" }),
    });
    const data = await res.json().catch(() => ({}));
    record("reports.submit.missing_reason", "POST", "/api/reports", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/reports`, {
      method: "POST",
      headers: { ...userHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ posterId: "nonexistent_poster_123", reason: "Copyright issue" }),
    });
    const data = await res.json().catch(() => ({}));
    record("reports.submit.nonexistent_poster", "POST", "/api/reports", res.status, data);
  }

  // 18b. Submit Report Normal
  {
    const res = await fetch(`${BASE_URL}/api/reports`, {
      method: "POST",
      headers: { ...userHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "Smoke test issue report",
        details: "Detailed smoke report info",
      }),
    });
    const data = await res.json().catch(() => ({}));
    createdReportId = data.reportId || "";
    record("reports.submit", "POST", "/api/reports", res.status, data);
  }

  // 18c. Reports Admin List Auth Failures
  {
    const res = await fetch(`${BASE_URL}/api/reports`);
    const data = await res.json().catch(() => ({}));
    record("reports.adminList.no_cookie", "GET", "/api/reports", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/reports`, {
      headers: { Cookie: "poster_admin_token=invalid_token" },
    });
    const data = await res.json().catch(() => ({}));
    record("reports.adminList.invalid_cookie", "GET", "/api/reports", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/reports`, {
      headers: userHeaders,
    });
    const data = await res.json().catch(() => ({}));
    record("reports.adminList.user_cookie", "GET", "/api/reports", res.status, data);
  }

  // 18d. Reports Admin List Normal
  {
    const res = await fetch(`${BASE_URL}/api/reports`, { headers: adminHeaders });
    const data = await res.json().catch(() => ({}));
    record("reports.adminList", "GET", "/api/reports", res.status, data);
  }

  // 18e. Reports Admin Resolve Auth & Not-Found Failures
  if (createdReportId) {
    {
      const res = await fetch(`${BASE_URL}/api/reports/${createdReportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      const data = await res.json().catch(() => ({}));
      record("reports.adminResolve.no_cookie", "PATCH", `/api/reports/${createdReportId}`, res.status, data);
    }
    {
      const res = await fetch(`${BASE_URL}/api/reports/${createdReportId}`, {
        method: "PATCH",
        headers: { Cookie: "poster_admin_token=invalid_token", "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      const data = await res.json().catch(() => ({}));
      record("reports.adminResolve.invalid_cookie", "PATCH", `/api/reports/${createdReportId}`, res.status, data);
    }
    {
      const res = await fetch(`${BASE_URL}/api/reports/${createdReportId}`, {
        method: "PATCH",
        headers: { ...userHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      });
      const data = await res.json().catch(() => ({}));
      record("reports.adminResolve.user_cookie", "PATCH", `/api/reports/${createdReportId}`, res.status, data);
    }
  }
  {
    const res = await fetch(`${BASE_URL}/api/reports/nonexistent_report_id_999`, {
      method: "PATCH",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    const data = await res.json().catch(() => ({}));
    record("reports.adminResolve.nonexistent", "PATCH", "/api/reports/nonexistent_report_id_999", res.status, data);
  }

  // 18f. Reports Admin Resolve Normal
  if (createdReportId) {
    const res = await fetch(`${BASE_URL}/api/reports/${createdReportId}`, {
      method: "PATCH",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved", resolutionNote: "Resolved in smoke test" }),
    });
    const data = await res.json().catch(() => ({}));
    record("reports.adminResolve", "PATCH", `/api/reports/${createdReportId}`, res.status, data);
  }

  // 19. Safety Blocklist: GET, POST, DELETE
  {
    const res = await fetch(`${BASE_URL}/api/safety/blocklist`);
    const data = await res.json().catch(() => ({}));
    record("safety.blocklist.get", "GET", "/api/safety/blocklist", res.status, data);
  }
  // 19b. Safety POST Auth & Input Failures
  {
    const res = await fetch(`${BASE_URL}/api/safety/blocklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: "smoke_bad_word" }),
    });
    const data = await res.json().catch(() => ({}));
    record("safety.blocklist.post.no_cookie", "POST", "/api/safety/blocklist", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/safety/blocklist`, {
      method: "POST",
      headers: { Cookie: "poster_admin_token=invalid_token", "Content-Type": "application/json" },
      body: JSON.stringify({ word: "smoke_bad_word" }),
    });
    const data = await res.json().catch(() => ({}));
    record("safety.blocklist.post.invalid_cookie", "POST", "/api/safety/blocklist", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/safety/blocklist`, {
      method: "POST",
      headers: { ...userHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ word: "smoke_bad_word" }),
    });
    const data = await res.json().catch(() => ({}));
    record("safety.blocklist.post.user_cookie", "POST", "/api/safety/blocklist", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/safety/blocklist`, {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    record("safety.blocklist.post.missing_word", "POST", "/api/safety/blocklist", res.status, data);
  }

  // 19c. Safety Normal POST
  {
    const res = await fetch(`${BASE_URL}/api/safety/blocklist`, {
      method: "POST",
      headers: { ...adminHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ word: "smoke_bad_word", category: "misuse" }),
    });
    const data = await res.json().catch(() => ({}));
    record("safety.blocklist.post", "POST", "/api/safety/blocklist", res.status, data);
  }

  // 19d. Safety DELETE Auth & Input Failures
  {
    const res = await fetch(`${BASE_URL}/api/safety/blocklist?word=smoke_bad_word`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    record("safety.blocklist.delete.no_cookie", "DELETE", "/api/safety/blocklist", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/safety/blocklist?word=smoke_bad_word`, {
      method: "DELETE",
      headers: { Cookie: "poster_admin_token=invalid_token" },
    });
    const data = await res.json().catch(() => ({}));
    record("safety.blocklist.delete.invalid_cookie", "DELETE", "/api/safety/blocklist", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/safety/blocklist?word=smoke_bad_word`, {
      method: "DELETE",
      headers: userHeaders,
    });
    const data = await res.json().catch(() => ({}));
    record("safety.blocklist.delete.user_cookie", "DELETE", "/api/safety/blocklist", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/safety/blocklist`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    const data = await res.json().catch(() => ({}));
    record("safety.blocklist.delete.missing_param", "DELETE", "/api/safety/blocklist", res.status, data);
  }

  // 19e. Safety Normal DELETE
  {
    const res = await fetch(`${BASE_URL}/api/safety/blocklist?word=smoke_bad_word`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    const data = await res.json().catch(() => ({}));
    record("safety.blocklist.delete", "DELETE", "/api/safety/blocklist", res.status, data);
  }

  // 20. Analytics: Event Log, Summary
  // 20a. Analytics Log Missing EventType
  {
    const res = await fetch(`${BASE_URL}/api/analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    record("analytics.log.missing_event_type", "POST", "/api/analytics", res.status, data);
  }

  // 20b-1. Analytics Log Unknown EventType
  {
    const res = await fetch(`${BASE_URL}/api/analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "smoke_session", eventType: "totally_unknown_event" }),
    });
    const data = await res.json().catch(() => ({}));
    record("analytics.log.unknown_event_type", "POST", "/api/analytics", res.status, data);
  }

  // 20b-2. Analytics Log Very Large Metadata (> 2 KB)
  {
    const largeMeta = { bigPayload: "x".repeat(3000) };
    const res = await fetch(`${BASE_URL}/api/analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "smoke_session", eventType: "template_opened", metadata: largeMeta }),
    });
    const data = await res.json().catch(() => ({}));
    record("analytics.log.large_metadata", "POST", "/api/analytics", res.status, data);
  }

  // 20b-3. Analytics Log Normal (valid allowlisted eventType)
  {
    const res = await fetch(`${BASE_URL}/api/analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "smoke_session", eventType: "template_opened" }),
    });
    const data = await res.json().catch(() => ({}));
    record("analytics.log", "POST", "/api/analytics", res.status, data);
  }

  // 20b-4. Analytics Rapid Repeated Calls (Rate limit trigger)
  {
    const rapidIp = "127.0.0.198";
    let lastStatus = 200;
    let lastData: any = {};
    for (let i = 0; i < 35; i++) {
      const res = await fetch(`${BASE_URL}/api/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": rapidIp },
        body: JSON.stringify({ sessionId: "smoke_session", eventType: "template_opened" }),
      });
      lastStatus = res.status;
      lastData = await res.json().catch(() => ({}));
      if (lastStatus === 429) break;
    }
    record("analytics.log.rapid_calls", "POST", "/api/analytics", lastStatus, lastData);
  }

  // 20c. Analytics Summary Auth Failures
  {
    const res = await fetch(`${BASE_URL}/api/analytics?range=7d`);
    const data = await res.json().catch(() => ({}));
    record("analytics.summary.no_cookie", "GET", "/api/analytics?range=7d", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/analytics?range=7d`, {
      headers: { Cookie: "poster_admin_token=invalid_token" },
    });
    const data = await res.json().catch(() => ({}));
    record("analytics.summary.invalid_cookie", "GET", "/api/analytics?range=7d", res.status, data);
  }
  {
    const res = await fetch(`${BASE_URL}/api/analytics?range=7d`, {
      headers: userHeaders,
    });
    const data = await res.json().catch(() => ({}));
    record("analytics.summary.user_cookie", "GET", "/api/analytics?range=7d", res.status, data);
  }

  // 20d. Analytics Summary Invalid Range
  {
    const res = await fetch(`${BASE_URL}/api/analytics?range=invalid_date_range`, { headers: adminHeaders });
    const data = await res.json().catch(() => ({}));
    record("analytics.summary.invalid_range", "GET", "/api/analytics?range=invalid_date_range", res.status, data);
  }

  // 20e. Analytics Summary Normal
  {
    const res = await fetch(`${BASE_URL}/api/analytics?range=7d`, { headers: adminHeaders });
    const data = await res.json().catch(() => ({}));
    record("analytics.summary", "GET", "/api/analytics?range=7d", res.status, data);
  }

  // 21. AI Moderate Image
  {
    const formData = new FormData();
    const dummyBlob = new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64")], {
      type: "image/png",
    });
    formData.append("file", dummyBlob, "test.png");
    const res = await fetch(`${BASE_URL}/api/moderate-image`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    record("ai.moderateImage", "POST", "/api/moderate-image", res.status, data);
  }

  // 22. Clean up created template
  if (createdTemplateId) {
    const res = await fetch(`${BASE_URL}/api/admin/templates/${createdTemplateId}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    const data = await res.json().catch(() => ({}));
    record("admin.templates.cleanup", "DELETE", `/api/admin/templates/${createdTemplateId}`, res.status, data);
  }

  // 23. Logout user & admin
  {
    const res = await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    record("auth.logout", "POST", "/api/auth/logout", res.status, data, res);
  }
  {
    const res = await fetch(`${BASE_URL}/api/admin/logout`, { method: "POST", headers: adminHeaders });
    const data = await res.json().catch(() => ({}));
    record("admin.logout", "POST", "/api/admin/logout", res.status, data, res);
  }

  return results;
}

async function main() {
  const isCompare = process.argv.includes("--compare");
  const isRecord = process.argv.includes("--record") || !fs.existsSync(BASELINE_PATH);

  const results = await runSmokeTest();

  if (isRecord) {
    fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(results, null, 2), "utf-8");
    console.log(`\n Baseline recorded to ${BASELINE_PATH} (${results.length} endpoints tested).\n`);
    return;
  }

  if (isCompare || fs.existsSync(BASELINE_PATH)) {
    const baseline: EndpointResult[] = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf-8"));
    console.log("\n=======================================================");
    console.log("            SMOKE TEST BASELINE COMPARISON             ");
    console.log("=======================================================\n");

    let diffCount = 0;
    const baseMap = new Map(baseline.map((b) => [b.name, b]));

    for (const r of results) {
      const b = baseMap.get(r.name);
      if (!b) {
        console.log(`⚠️  NEW ENDPOINT: ${r.name} (${r.method} ${r.url})`);
        diffCount++;
        continue;
      }

      const statusMatches = b.statusCode === r.statusCode;
      const keysMatches = JSON.stringify(b.keys) === JSON.stringify(r.keys);
      const errorMatches = !b.errorMessage || b.errorMessage === r.errorMessage;
      const cookieMatches = !b.cookies || (
        b.cookies.name === r.cookies?.name &&
        b.cookies["max-age"] === r.cookies?.["max-age"] &&
        b.cookies.httponly === r.cookies?.httponly &&
        b.cookies.samesite === r.cookies?.samesite &&
        b.cookies.path === r.cookies?.path
      );

      if (!statusMatches || !keysMatches || !errorMatches || !cookieMatches) {
        diffCount++;
        console.log(`❌ DIFF in ${r.name} (${r.method} ${r.url}):`);
        if (!statusMatches) console.log(`   Status code: expected ${b.statusCode}, got ${r.statusCode}`);
        if (!keysMatches) {
          console.log(`   Keys expected: ${b.keys.join(", ")}`);
          console.log(`   Keys got:      ${r.keys.join(", ")}`);
        }
        if (!errorMatches) {
          console.log(`   Error expected: "${b.errorMessage}"`);
          console.log(`   Error got:      "${r.errorMessage}"`);
        }
        if (!cookieMatches) {
          console.log(`   Cookies expected: ${JSON.stringify(b.cookies)}`);
          console.log(`   Cookies got:      ${JSON.stringify(r.cookies)}`);
        }
      } else {
        const extraInfo = [
          `Keys: ${r.keys.join(", ")}`,
          r.errorMessage ? `Error: "${r.errorMessage}"` : "",
          r.cookies ? `Cookie: ${r.cookies.name} (Max-Age=${r.cookies["max-age"]}, HttpOnly=${r.cookies.httponly})` : "",
        ]
          .filter(Boolean)
          .join(" | ");
        console.log(`✓ ${r.name.padEnd(28)} [${r.statusCode}] ${extraInfo}`);
      }
    }

    if (diffCount === 0) {
      console.log(`\n🎉 ALL ${results.length} ENDPOINTS MATCH BASELINE PERFECTLY!\n`);
    } else {
      console.log(`\n⚠️  Found ${diffCount} differences against baseline!\n`);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error("Smoke test failure:", err);
  process.exit(1);
});
