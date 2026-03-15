import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { insuranceClaimCreateSchema } from "@/lib/validations/insurance";
import { generateClaimNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("billing", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = searchParams.get("status");
  const patientId = searchParams.get("patientId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (patientId) where.patientId = patientId;

  const [claims, total] = await Promise.all([
    prisma.insuranceClaim.findMany({ where: where as never, skip, take: limit, orderBy: { createdAt: "desc" }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } }, provider: { select: { id: true, name: true } }, policy: { select: { policyNumber: true } } } }),
    prisma.insuranceClaim.count({ where: where as never }),
  ]);
  return successResponse(claims, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("billing", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = insuranceClaimCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const claimNo = await generateClaimNo();
  const data: Record<string, unknown> = { ...parsed.data, claimNo, submittedBy: session!.user.id };
  if (parsed.data.admissionDate) data.admissionDate = new Date(parsed.data.admissionDate);
  if (parsed.data.dischargeDate) data.dischargeDate = new Date(parsed.data.dischargeDate);

  const claim = await prisma.insuranceClaim.create({ data: data as never });
  return createdResponse(claim);
}
