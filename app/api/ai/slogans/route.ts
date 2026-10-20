import { handle } from "@/backend/middleware/handle";
import { withOptionalUser } from "@/backend/middleware/auth";
import { withRateLimit } from "@/backend/middleware/rateLimit";
import { withValidation } from "@/backend/middleware/validate";
import { suggestSlogansSchema } from "@/backend/schemas/ai.schema";
import { suggestSlogansController } from "@/backend/controllers/ai.controller";

export const POST = handle(
  withRateLimit("ai_slogans", 30, 60)(
    withOptionalUser(
      withValidation({ body: suggestSlogansSchema }, suggestSlogansController)
    )
  )
);
