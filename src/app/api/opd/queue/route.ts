import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("opd", "view");
  if (error) return error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);

  const queue = await prisma.appointment.findMany({
    where: { date: { gte: today, lt: tomorrow }, status: { in: ["SCHEDULED", "CHECKED_IN", "IN_PROGRESS"] } },
    include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } }, doctor: { select: { id: true, user: { select: { name: true } }, specialization: true } } },
    orderBy: [{ tokenNumber: "asc" }, { startTime: "asc" }],
  });

  return successResponse(queue);
}
