import { NextResponse } from "next/server";
import * as packagesService from "@/backend/services/packages.service";
import type { CreatePackageInput, UpdatePackageInput, PackageIdParamsInput } from "@/backend/schemas/packages.schema";

export async function createAdminPackageController(_req: Request, ctx: { validated: { body: CreatePackageInput } }) {
  const pkg = await packagesService.createPackage(ctx.validated.body);
  return NextResponse.json({ success: true, package: pkg }, { status: 201 });
}

export async function updateAdminPackageController(
  _req: Request,
  ctx: { validated: { params: PackageIdParamsInput; body: UpdatePackageInput } }
) {
  const pkg = await packagesService.updatePackage(ctx.validated.params.id, ctx.validated.body);
  return { success: true, package: pkg };
}

export async function deleteAdminPackageController(
  _req: Request,
  ctx: { validated: { params: PackageIdParamsInput } }
) {
  return await packagesService.deletePackage(ctx.validated.params.id);
}
