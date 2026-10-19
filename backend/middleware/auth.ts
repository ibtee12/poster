import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, USER_COOKIE_NAME } from "@/backend/config/constants";
import { verifyAuthToken } from "@/backend/middleware/adminAuth";
import { getUserFromToken } from "@/backend/services/auth.service";
import { UnauthorizedError } from "@/backend/common/errors";

async function extractUserToken(req: Request): Promise<string | undefined> {
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${USER_COOKIE_NAME}=`));
    if (match) {
      return match.split("=")[1];
    }
  }

  try {
    const cookieStore = await cookies();
    return cookieStore.get(USER_COOKIE_NAME)?.value;
  } catch {
    return undefined;
  }
}

export async function isCallerAdmin(req: Request): Promise<boolean> {
  let adminToken: string | undefined;
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
    if (match) {
      adminToken = match.split("=")[1];
    }
  }

  if (!adminToken) {
    try {
      const cookieStore = await cookies();
      adminToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    } catch {
      // Not in cookies context
    }
  }

  return verifyAuthToken(adminToken);
}

export function withAdmin(
  handler: (req: Request, ctx?: any) => Promise<any>,
  unauthorizedMessage?: string
): (req: Request, ctx?: any) => Promise<any>;
export function withAdmin(
  unauthorizedMessage: string
): (handler: (req: Request, ctx?: any) => Promise<any>) => (req: Request, ctx?: any) => Promise<any>;
export function withAdmin(
  handlerOrMsg: ((req: Request, ctx?: any) => Promise<any>) | string,
  maybeMsg?: string
) {
  if (typeof handlerOrMsg === "string") {
    const unauthorizedMessage = handlerOrMsg;
    return (handler: (req: Request, ctx?: any) => Promise<any>) => {
      return withAdmin(handler, unauthorizedMessage);
    };
  }

  const handler = handlerOrMsg;
  const unauthorizedMessage = maybeMsg || "Unauthorized. Admin access required.";

  return async (req: Request, ctx?: any) => {
    const isAuthed = await isCallerAdmin(req);
    if (!isAuthed) {
      throw new UnauthorizedError(unauthorizedMessage);
    }

    return handler(req, { ...ctx, isAdmin: true });
  };
}

export function withUser(handler: (req: Request, ctx?: any) => Promise<any>) {
  return async (req: Request, ctx?: any) => {
    const token = await extractUserToken(req);
    const user = await getUserFromToken(token);
    if (!user) {
      throw new UnauthorizedError("Unauthorized. Please log in.");
    }

    return handler(req, { ...ctx, user });
  };
}

export function withOptionalUser(handler: (req: Request, ctx?: any) => Promise<any>) {
  return async (req: Request, ctx?: any) => {
    const token = await extractUserToken(req);
    const user = await getUserFromToken(token);
    return handler(req, { ...ctx, user });
  };
}
