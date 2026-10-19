import { handle } from "@/backend/middleware/handle";
import { withAdmin } from "@/backend/middleware/auth";
import { withValidation } from "@/backend/middleware/validate";
import { createPackageSchema } from "@/backend/schemas/packages.schema";
import { createAdminPackageController } from "@/backend/controllers/admin.packages.controller";

export const POST = handle(
  withAdmin(withValidation({ body: createPackageSchema }, createAdminPackageController), "Unauthorized")
);
