import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, errorResponse } from "@/lib/helpers/api-response";
import { patientUpdateSchema } from "@/lib/validations/patient";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("patients", "view");
  if (error) return error;

  const { id } = await params;
  const patient = await prisma.patient.findUnique({
    where: { id, deletedAt: null },
    include: { appointments: { take: 10, orderBy: { date: "desc" } }, consultations: { take: 10, orderBy: { createdAt: "desc" } }, admissions: { take: 5, orderBy: { createdAt: "desc" } } },
  });

  if (!patient) return errorResponse("Patient not found", 404);
  return successResponse(patient);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("patients", "edit");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = patientUpdateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.dateOfBirth) data.dateOfBirth = new Date(parsed.data.dateOfBirth);

  const patient = await prisma.patient.update({ where: { id }, data: data as never });
  return successResponse(patient);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("patients", "delete");
  if (error) return error;

  const { id } = await params;
  await prisma.patient.update({ where: { id }, data: { deletedAt: new Date() } });
  return successResponse({ message: "Patient deleted" });
}
