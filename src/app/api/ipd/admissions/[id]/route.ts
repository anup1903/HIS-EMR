import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, errorResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("ipd", "view");
  if (error) return error;

  const { id } = await params;
  const admission = await prisma.admission.findUnique({
    where: { id },
    include: { patient: true, doctor: { include: { user: { select: { name: true } } } }, bed: { include: { ward: true } }, vitals: { orderBy: { recordedAt: "desc" } }, progressNotes: { orderBy: { recordedAt: "desc" } }, doctorOrders: { orderBy: { orderedAt: "desc" } } },
  });
  if (!admission) return errorResponse("Admission not found", 404);
  return successResponse(admission);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("ipd", "edit");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const admission = await prisma.admission.update({ where: { id }, data: body });
  return successResponse(admission);
}
