import { handle } from "@/backend/middleware/handle";
import { getPackagesController } from "@/backend/controllers/packages.controller";

export const GET = handle(getPackagesController);
