import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("appointments", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId");

  const where: Record<string, unknown> = { isAvailable: true };
  if (departmentId) where.departmentId = departmentId;

  const doctors = await prisma.doctor.findMany({
    where: where as never,
    include: { user: { select: { name: true } }, department: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return successResponse(doctors);
}
