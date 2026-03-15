import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, errorResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("opd", "view");
  if (error) return error;

  const { id } = await params;
  const consultation = await prisma.consultation.findUnique({
    where: { id },
    include: { patient: true, doctor: { include: { user: { select: { name: true } } } }, vitals: true, prescriptions: { include: { items: { include: { drug: true } } } }, labOrders: { include: { items: { include: { labTest: true } } } }, radiologyOrders: { include: { items: { include: { examType: true } } } } },
  });
  if (!consultation) return errorResponse("Consultation not found", 404);
  return successResponse(consultation);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("opd", "edit");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const consultation = await prisma.consultation.update({ where: { id }, data: body });
  return successResponse(consultation);
}
