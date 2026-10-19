import { handle } from "@/backend/middleware/handle";
import { withValidation } from "@/backend/middleware/validate";
import { loginSchema } from "@/backend/schemas/auth.schema";
import { loginController } from "@/backend/controllers/auth.controller";

export const POST = handle(withValidation({ body: loginSchema }, loginController));
