import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, createdResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("hr", "view");
  if (error) return error;

  const departments = await prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, include: { _count: { select: { doctors: true, employees: true } } } });
  return successResponse(departments);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("hr", "create");
  if (error) return error;

  const body = await req.json();
  const department = await prisma.department.create({ data: body });
  return createdResponse(department);
}
