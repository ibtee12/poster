import * as safetyService from "@/backend/services/safety.service";
import type { AddBlocklistWordInput, DeleteBlocklistWordInput } from "@/backend/schemas/safety.schema";

export async function getBlocklistController() {
  return await safetyService.getBlocklist();
}

export async function addBlocklistWordController(_req: Request, ctx: { validated: { body: AddBlocklistWordInput } }) {
  const item = await safetyService.addBlocklistWord(ctx.validated.body.word, ctx.validated.body.category);
  return { success: true, item };
}

export async function deleteBlocklistWordController(_req: Request, ctx: { validated: { query: DeleteBlocklistWordInput } }) {
  await safetyService.deleteBlocklistWord(ctx.validated.query.word);
  return { success: true };
}
