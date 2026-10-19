import { handle } from "@/backend/middleware/handle";
import { withAdmin } from "@/backend/middleware/auth";
import { withValidation } from "@/backend/middleware/validate";
import { packageIdParamsSchema, updatePackageSchema } from "@/backend/schemas/packages.schema";
import {
  updateAdminPackageController,
  deleteAdminPackageController,
} from "@/backend/controllers/admin.packages.controller";

export const PATCH = handle(
  withAdmin(
    withValidation(
      { params: packageIdParamsSchema, body: updatePackageSchema },
      updateAdminPackageController
    ),
    "Unauthorized"
  )
);

export const DELETE = handle(
  withAdmin(
    withValidation({ params: packageIdParamsSchema }, deleteAdminPackageController),
    "Unauthorized"
  )
);
