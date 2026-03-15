import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { consultationCreateSchema } from "@/lib/validations/consultation";
import { generateConsultationNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("opd", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const date = searchParams.get("date");
  const doctorId = searchParams.get("doctorId");

  const where: Record<string, unknown> = {};
  if (date) where.createdAt = { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) };
  if (doctorId) where.doctorId = doctorId;

  const [consultations, total] = await Promise.all([
    prisma.consultation.findMany({ where: where as never, skip, take: limit, orderBy: { createdAt: "desc" }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } }, doctor: { select: { id: true, user: { select: { name: true } } } } } }),
    prisma.consultation.count({ where: where as never }),
  ]);

  return successResponse(consultations, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("opd", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = consultationCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const consultationNo = await generateConsultationNo();
  const data: Record<string, unknown> = { ...parsed.data, consultationNo };
  if (parsed.data.followUpDate) data.followUpDate = new Date(parsed.data.followUpDate);

  const consultation = await prisma.consultation.create({ data: data as never });
  return createdResponse(consultation);
}
