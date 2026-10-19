import { ZodSchema, ZodError } from "zod";
import { ValidationError } from "@/backend/common/errors";

export interface ValidationSchemas {
  body?: ZodSchema<any>;
  params?: ZodSchema<any>;
  query?: ZodSchema<any>;
}

function formatZodError(error: ZodError): string {
  const issues = error.issues;
  if (issues.length > 0) {
    const first = issues[0];
    return first.message || `Invalid ${first.path.join(".")}`;
  }
  return "Validation error";
}

export function withValidation(
  schemas: ValidationSchemas,
  handler: (req: Request, ctx?: any) => Promise<any>
): (req: Request, ctx?: any) => Promise<any>;
export function withValidation(
  schemas: ValidationSchemas
): (handler: (req: Request, ctx?: any) => Promise<any>) => (req: Request, ctx?: any) => Promise<any>;
export function withValidation(
  schemas: ValidationSchemas,
  handler?: (req: Request, ctx?: any) => Promise<any>
) {
  const wrapper = (innerHandler: (req: Request, ctx?: any) => Promise<any>) => {
    return async (req: Request, ctx?: any) => {
      let validatedBody: any = undefined;
      let validatedParams: any = undefined;
      let validatedQuery: any = undefined;

      // 1. Validate Params
      if (schemas.params) {
        let rawParams = ctx?.params;
        if (rawParams && typeof rawParams.then === "function") {
          rawParams = await rawParams;
        }
        const result = schemas.params.safeParse(rawParams || {});
        if (!result.success) {
          throw new ValidationError(formatZodError(result.error));
        }
        validatedParams = result.data;
      }

      // 2. Validate Query
      if (schemas.query) {
        const url = new URL(req.url);
        const queryObj: Record<string, string> = {};
        url.searchParams.forEach((val, key) => {
          queryObj[key] = val;
        });
        const result = schemas.query.safeParse(queryObj);
        if (!result.success) {
          throw new ValidationError(formatZodError(result.error));
        }
        validatedQuery = result.data;
      }

      // 3. Validate Body (only if method is not GET / HEAD)
      if (schemas.body && req.method !== "GET" && req.method !== "HEAD") {
        const contentType = req.headers.get("content-type") || "";
        let rawBody: any;
        if (contentType.includes("application/json")) {
          try {
            rawBody = await req.json();
          } catch {
            throw new ValidationError("Invalid JSON body");
          }
        } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
          rawBody = await req.formData();
        } else {
          try {
            rawBody = await req.json();
          } catch {
            rawBody = {};
          }
        }

        const result = schemas.body.safeParse(rawBody);
        if (!result.success) {
          throw new ValidationError(formatZodError(result.error));
        }
        validatedBody = result.data;
      }

      const nextCtx = {
        ...ctx,
        validated: {
          body: validatedBody,
          params: validatedParams,
          query: validatedQuery,
        },
      };

      return innerHandler(req, nextCtx);
    };
  };

  if (handler) {
    return wrapper(handler);
  }
  return wrapper;
}
