import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { instrumentSetCreateSchema } from "@/lib/validations/cssd";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("inventory", "view");
  if (error) return error;

  const instruments = await prisma.instrumentSet.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, include: { _count: { select: { batches: true } } } });
  return successResponse(instruments);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("inventory", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = instrumentSetCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const instrument = await prisma.instrumentSet.create({ data: parsed.data as never });
  return createdResponse(instrument);
}
