import { isCallerAdmin } from "@/backend/middleware/auth";
import * as postersService from "@/backend/services/posters.service";
import type {
  CreatePosterInput,
  PosterIdParamsInput,
  PosterFilePathParamsInput,
} from "@/backend/schemas/posters.schema";

export async function getUserPostersController(
  _req: Request,
  ctx: { user: { id: string } }
) {
  return await postersService.getUserPosters(ctx.user.id);
}

export async function createPosterController(
  _req: Request,
  ctx: { user: { id: string }; validated: { body: CreatePosterInput } }
) {
  return await postersService.createPoster(ctx.user.id, ctx.validated.body);
}

export async function getPosterByIdController(
  req: Request,
  ctx: { user?: { id: string } | null; validated: { params: PosterIdParamsInput } }
) {
  const isAdmin = await isCallerAdmin(req);
  return await postersService.getPosterById(ctx.validated.params.id, {
    id: ctx.user?.id,
    isAdmin,
  });
}

export async function deletePosterController(
  _req: Request,
  ctx: { user: { id: string }; validated: { params: PosterIdParamsInput } }
) {
  return await postersService.deletePoster(ctx.validated.params.id, ctx.user.id);
}

export async function duplicatePosterController(
  _req: Request,
  ctx: { user: { id: string }; validated: { params: PosterIdParamsInput } }
) {
  return await postersService.duplicatePoster(ctx.validated.params.id, ctx.user.id);
}

export async function getPosterFileController(
  req: Request,
  ctx: { params: Promise<{ path: string[] }>; user?: { id: string } | null }
) {
  const { path: pathSegments } = await ctx.params;
  const isAdmin = await isCallerAdmin(req);
  const { buffer, contentType } = await postersService.getPosterFile(pathSegments, {
    id: ctx.user?.id,
    isAdmin,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}
