import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("ipd", "view");
  if (error) return error;

  const wards = await prisma.ward.findMany({
    where: { isActive: true },
    include: { beds: { include: { admissions: { where: { status: "ADMITTED" }, select: { id: true, patient: { select: { firstName: true, lastName: true, mrn: true } } }, take: 1 } } }, department: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  return successResponse(wards);
}
