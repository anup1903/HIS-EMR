import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, errorResponse } from "@/lib/helpers/api-response";
import { appointmentUpdateSchema } from "@/lib/validations/appointment";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("appointments", "view");
  if (error) return error;

  const { id } = await params;
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { patient: true, doctor: { include: { user: { select: { name: true, email: true } } } }, consultation: true },
  });
  if (!appointment) return errorResponse("Appointment not found", 404);
  return successResponse(appointment);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("appointments", "edit");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = appointmentUpdateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.date) data.date = new Date(parsed.data.date);

  const appointment = await prisma.appointment.update({ where: { id }, data: data as never });
  return successResponse(appointment);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("appointments", "delete");
  if (error) return error;

  const { id } = await params;
  await prisma.appointment.update({ where: { id }, data: { status: "CANCELLED" } });
  return successResponse({ message: "Appointment cancelled" });
}
