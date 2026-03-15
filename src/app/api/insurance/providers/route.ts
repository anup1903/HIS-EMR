import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { insuranceProviderCreateSchema } from "@/lib/validations/insurance";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("billing", "view");
  if (error) return error;

  const providers = await prisma.insuranceProvider.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, include: { _count: { select: { policies: true, claims: true } } } });
  return successResponse(providers);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("billing", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = insuranceProviderCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const provider = await prisma.insuranceProvider.create({ data: parsed.data as never });
  return createdResponse(provider);
}
