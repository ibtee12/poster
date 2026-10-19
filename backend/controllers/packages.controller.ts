import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/backend/config/constants";
import { verifyAuthToken } from "@/backend/middleware/adminAuth";
import * as packagesService from "@/backend/services/packages.service";

export async function getPackagesController(req: Request) {
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "true";

  let isAdmin = false;
  if (all) {
    const cookieHeader = req.headers.get("cookie");
    let adminToken: string | undefined;
    if (cookieHeader) {
      const match = cookieHeader
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
      if (match) adminToken = match.split("=")[1];
    }
    if (!adminToken) {
      try {
        const cookieStore = await cookies();
        adminToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
      } catch {
        // Not in cookies context
      }
    }
    isAdmin = await verifyAuthToken(adminToken);
  }

  const packages = await packagesService.getPackages(isAdmin, all);
  return { packages };
}
