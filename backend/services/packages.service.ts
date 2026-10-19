import { prisma } from "../db/prisma";
import type { CreatePackageInput, UpdatePackageInput } from "../schemas/packages.schema";

export async function getPackages(isAdmin = false, all = false) {
  return await prisma.package.findMany({
    where: isAdmin && all ? {} : { active: true },
    orderBy: { price: "asc" },
  });
}

export async function createPackage(data: CreatePackageInput) {
  return await prisma.package.create({
    data: {
      name: data.name.trim(),
      credits: Math.round(data.credits),
      price: data.price,
      currency: data.currency || "BDT",
      active: data.active !== undefined ? Boolean(data.active) : true,
    },
  });
}

export async function updatePackage(id: string, data: UpdatePackageInput) {
  return await prisma.package.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.credits !== undefined && { credits: Math.round(data.credits) }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.currency !== undefined && { currency: data.currency }),
      ...(data.active !== undefined && { active: Boolean(data.active) }),
    },
  });
}

export async function deletePackage(id: string) {
  const paymentsCount = await prisma.payment.count({
    where: { packageId: id },
  });

  if (paymentsCount > 0) {
    await prisma.package.update({
      where: { id },
      data: { active: false },
    });
    return { success: true, deactivated: true };
  }

  await prisma.package.delete({
    where: { id },
  });

  return { success: true };
}
