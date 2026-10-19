import { handle } from "@/backend/middleware/handle";
import { withValidation } from "@/backend/middleware/validate";
import { signupSchema } from "@/backend/schemas/auth.schema";
import { signupController } from "@/backend/controllers/auth.controller";

export const POST = handle(withValidation({ body: signupSchema }, signupController));
