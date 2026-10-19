import { NextResponse } from "next/server";
import { AppError } from "@/backend/common/errors";

export type RouteHandler = (
  req: Request,
  ctx?: any
) => Promise<Response | NextResponse | any>;

export function handle(fn: RouteHandler) {
  return async (req: Request, ctx?: any): Promise<Response> => {
    try {
      const result = await fn(req, ctx);
      if (result instanceof Response) {
        return result;
      }
      return NextResponse.json(result);
    } catch (err: any) {
      if (err instanceof AppError) {
        if (err.responseFormat === "allowed_false") {
          return NextResponse.json(
            { allowed: false, error: err.message },
            { status: err.statusCode }
          );
        }
        if (err.responseFormat === "success_false") {
          return NextResponse.json(
            { success: false, error: err.message, ...(err.details || {}) },
            { status: err.statusCode }
          );
        }
        return NextResponse.json(
          { error: err.message, ...(err.details || {}) },
          { status: err.statusCode }
        );
      }

      console.error("Unhandled error in route handler:", err);
      const message = err?.message || "Internal server error";
      const status = typeof err?.statusCode === "number" ? err.statusCode : 500;
      return NextResponse.json({ error: message }, { status });
    }
  };
}
