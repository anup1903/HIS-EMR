import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { patientCreateSchema } from "@/lib/validations/patient";
import { generateMRN } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("patients", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const search = searchParams.get("search") || "";
  const gender = searchParams.get("gender") || "";

  const where: Record<string, unknown> = { deletedAt: null };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { mrn: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
    ];
  }
  if (gender) where.gender = gender;

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({ where: where as never, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.patient.count({ where: where as never }),
  ]);

  return successResponse(patients, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("patients", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = patientCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const mrn = await generateMRN();
  const patient = await prisma.patient.create({
    data: { ...parsed.data, mrn, dateOfBirth: new Date(parsed.data.dateOfBirth), email: parsed.data.email || null },
  });

  return createdResponse(patient);
}
