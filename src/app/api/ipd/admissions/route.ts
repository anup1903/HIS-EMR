import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { generateAdmissionNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("ipd", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [admissions, total] = await Promise.all([
    prisma.admission.findMany({ where: where as never, skip, take: limit, orderBy: { createdAt: "desc" }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } }, doctor: { select: { id: true, user: { select: { name: true } } } }, bed: { include: { ward: true } } } }),
    prisma.admission.count({ where: where as never }),
  ]);

  return successResponse(admissions, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("ipd", "create");
  if (error) return error;

  const body = await req.json();
  const admissionNo = await generateAdmissionNo();

  const admission = await prisma.$transaction(async (tx) => {
    await tx.bed.update({ where: { id: body.bedId }, data: { status: "OCCUPIED" } });
    return tx.admission.create({ data: { ...body, admissionNo } });
  });

  return createdResponse(admission);
}
