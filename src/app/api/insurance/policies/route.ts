import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { insurancePolicyCreateSchema } from "@/lib/validations/insurance";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("billing", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const patientId = searchParams.get("patientId");

  const where: Record<string, unknown> = { isActive: true };
  if (patientId) where.patientId = patientId;

  const [policies, total] = await Promise.all([
    prisma.insurancePolicy.findMany({ where: where as never, skip, take: limit, orderBy: { createdAt: "desc" }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } }, provider: { select: { id: true, name: true, code: true } } } }),
    prisma.insurancePolicy.count({ where: where as never }),
  ]);
  return successResponse(policies, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("billing", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = insurancePolicyCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const data: Record<string, unknown> = { ...parsed.data, balanceAmount: parsed.data.coverageAmount, startDate: new Date(parsed.data.startDate), endDate: new Date(parsed.data.endDate) };
  const policy = await prisma.insurancePolicy.create({ data: data as never });
  return createdResponse(policy);
}
