import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { labTestCreateSchema } from "@/lib/validations/laboratory";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("laboratory", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);

  const [tests, total] = await Promise.all([
    prisma.labTest.findMany({ where: { isActive: true }, skip, take: limit, orderBy: { name: "asc" } }),
    prisma.labTest.count({ where: { isActive: true } }),
  ]);

  return successResponse(tests, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("laboratory", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = labTestCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const test = await prisma.labTest.create({ data: parsed.data });
  return createdResponse(test);
}
