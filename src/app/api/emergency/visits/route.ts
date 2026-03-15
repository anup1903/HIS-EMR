import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { emergencyVisitCreateSchema } from "@/lib/validations/emergency";
import { generateEmergencyVisitNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("patients", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const disposition = searchParams.get("disposition");
  const triageLevel = searchParams.get("triageLevel");

  const where: Record<string, unknown> = {};
  if (disposition) where.disposition = disposition;
  if (triageLevel) where.triageLevel = triageLevel;

  const [visits, total] = await Promise.all([
    prisma.emergencyVisit.findMany({ where: where as never, skip, take: limit, orderBy: { arrivalTime: "desc" }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } } } }),
    prisma.emergencyVisit.count({ where: where as never }),
  ]);
  return successResponse(visits, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("patients", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = emergencyVisitCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const visitNo = await generateEmergencyVisitNo();
  const data: Record<string, unknown> = { ...parsed.data, visitNo, triagedBy: session!.user.id };
  const visit = await prisma.emergencyVisit.create({ data: data as never });
  return createdResponse(visit);
}
