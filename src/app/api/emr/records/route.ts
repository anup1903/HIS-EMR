import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { medicalRecordCreateSchema } from "@/lib/validations/emr";
import { generateMedicalRecordNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("patients", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const patientId = searchParams.get("patientId");
  const visitType = searchParams.get("visitType");
  const specialty = searchParams.get("specialty");

  const where: Record<string, unknown> = {};
  if (patientId) where.patientId = patientId;
  if (visitType) where.visitType = visitType;
  if (specialty) where.specialty = specialty;

  const [records, total] = await Promise.all([
    prisma.medicalRecord.findMany({ where: where as never, skip, take: limit, orderBy: { visitDate: "desc" }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } } } }),
    prisma.medicalRecord.count({ where: where as never }),
  ]);

  return successResponse(records, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("opd", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = medicalRecordCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const recordNo = await generateMedicalRecordNo();
  const data: Record<string, unknown> = { ...parsed.data, recordNo, recordedBy: session!.user.id };
  if (parsed.data.visitDate) data.visitDate = new Date(parsed.data.visitDate);

  const record = await prisma.medicalRecord.create({ data: data as never });
  return createdResponse(record);
}
