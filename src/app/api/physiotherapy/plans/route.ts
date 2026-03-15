import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { therapyPlanCreateSchema } from "@/lib/validations/physiotherapy";
import { generateTherapyPlanNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("opd", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const patientId = searchParams.get("patientId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (patientId) where.patientId = patientId;
  if (status) where.status = status;

  const [plans, total] = await Promise.all([
    prisma.therapyPlan.findMany({ where: where as never, skip, take: limit, orderBy: { createdAt: "desc" }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } }, sessions: { orderBy: { sessionNo: "desc" }, take: 3 } } }),
    prisma.therapyPlan.count({ where: where as never }),
  ]);
  return successResponse(plans, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("opd", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = therapyPlanCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const planNo = await generateTherapyPlanNo();
  const data: Record<string, unknown> = { ...parsed.data, planNo };
  if (parsed.data.startDate) data.startDate = new Date(parsed.data.startDate);
  if (parsed.data.endDate) data.endDate = new Date(parsed.data.endDate);

  const plan = await prisma.therapyPlan.create({ data: data as never });
  return createdResponse(plan);
}
