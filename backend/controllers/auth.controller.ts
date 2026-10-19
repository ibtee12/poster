import { NextResponse } from "next/server";
import { USER_COOKIE_NAME, COOKIE_MAX_AGE_USER } from "@/backend/config/constants";
import * as authService from "@/backend/services/auth.service";
import type { LoginInput, SignupInput } from "@/backend/schemas/auth.schema";

function setAuthCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(USER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_USER,
  });
  return res;
}

export async function loginController(_req: Request, ctx: { validated: { body: LoginInput } }) {
  const { user, token } = await authService.login(ctx.validated.body);
  return setAuthCookie(NextResponse.json({ success: true, user }), token);
}

export async function signupController(_req: Request, ctx: { validated: { body: SignupInput } }) {
  const { user, token } = await authService.signup(ctx.validated.body);
  return setAuthCookie(NextResponse.json({ success: true, user }), token);
}

export async function logoutController() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(USER_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function meController(_req: Request, ctx?: { user?: { id: string; email: string } | null }) {
  return { user: ctx?.user || null };
}
