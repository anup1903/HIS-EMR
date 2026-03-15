import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { appointmentCreateSchema } from "@/lib/validations/appointment";
import { generateAppointmentNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("appointments", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const date = searchParams.get("date");
  const doctorId = searchParams.get("doctorId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (date) where.date = { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) };
  if (doctorId) where.doctorId = doctorId;
  if (status) where.status = status;

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({ where: where as never, skip, take: limit, orderBy: { date: "asc" }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } }, doctor: { select: { id: true, user: { select: { name: true } }, specialization: true } } } }),
    prisma.appointment.count({ where: where as never }),
  ]);

  return successResponse(appointments, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("appointments", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = appointmentCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const appointmentNo = await generateAppointmentNo();
  const appointment = await prisma.appointment.create({
    data: { ...parsed.data, appointmentNo, date: new Date(parsed.data.date) },
  });

  return createdResponse(appointment);
}
