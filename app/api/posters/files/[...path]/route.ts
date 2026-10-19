import { handle } from "@/backend/middleware/handle";
import { withOptionalUser } from "@/backend/middleware/auth";
import { getPosterFileController } from "@/backend/controllers/posters.controller";

export const GET = handle(withOptionalUser(getPosterFileController));
