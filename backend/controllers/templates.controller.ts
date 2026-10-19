import { ok } from "@/backend/common/response";
import {
  getAllTemplates,
  getTemplateById,
  getTemplateImage,
} from "@/backend/services/templates.service";

export async function getAllTemplatesController() {
  const templates = await getAllTemplates();
  return ok(templates);
}

export async function getTemplateByIdController(_req: Request, ctx: { validated: { params: { id: string } } }) {
  const template = await getTemplateById(ctx.validated.params.id);
  return ok(template);
}

export async function getTemplateImageController(_req: Request, ctx: { validated: { params: { id: string; filename: string } } }) {
  const { buffer, contentType } = await getTemplateImage(ctx.validated.params.id, ctx.validated.params.filename);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
