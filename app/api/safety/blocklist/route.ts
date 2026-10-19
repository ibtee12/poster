import { handle } from "@/backend/middleware/handle";
import { withAdmin } from "@/backend/middleware/auth";
import { withValidation } from "@/backend/middleware/validate";
import { addBlocklistWordSchema, deleteBlocklistWordSchema } from "@/backend/schemas/safety.schema";
import {
  getBlocklistController,
  addBlocklistWordController,
  deleteBlocklistWordController,
} from "@/backend/controllers/safety.controller";

export const GET = handle(getBlocklistController);
export const POST = handle(withAdmin(withValidation({ body: addBlocklistWordSchema }, addBlocklistWordController), "Unauthorized"));
export const DELETE = handle(withAdmin(withValidation({ query: deleteBlocklistWordSchema }, deleteBlocklistWordController), "Unauthorized"));
