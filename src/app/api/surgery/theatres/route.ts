import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { otCreateSchema } from "@/lib/validations/surgery";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("ipd", "view");
  if (error) return error;

  const theatres = await prisma.operationTheatre.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, include: { _count: { select: { surgeries: true } } } });
  return successResponse(theatres);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("ipd", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = otCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const theatre = await prisma.operationTheatre.create({ data: parsed.data as never });
  return createdResponse(theatre);
}
