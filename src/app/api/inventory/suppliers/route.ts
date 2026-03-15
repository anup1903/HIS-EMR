import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { supplierCreateSchema } from "@/lib/validations/inventory";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("inventory", "view");
  if (error) return error;

  const suppliers = await prisma.supplier.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return successResponse(suppliers);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("inventory", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = supplierCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const supplier = await prisma.supplier.create({ data: parsed.data as never });
  return createdResponse(supplier);
}
