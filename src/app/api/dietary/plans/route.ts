import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { dietPlanCreateSchema } from "@/lib/validations/dietary";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("ipd", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const patientId = searchParams.get("patientId");

  const where: Record<string, unknown> = { isActive: true };
  if (patientId) where.patientId = patientId;

  const [plans, total] = await Promise.all([
    prisma.dietPlan.findMany({ where: where as never, skip, take: limit, orderBy: { createdAt: "desc" }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } }, mealOrders: { where: { date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }, orderBy: { date: "asc" } } } }),
    prisma.dietPlan.count({ where: where as never }),
  ]);
  return successResponse(plans, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("ipd", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = dietPlanCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const data: Record<string, unknown> = { ...parsed.data, prescribedBy: session!.user.id };
  if (parsed.data.startDate) data.startDate = new Date(parsed.data.startDate);
  if (parsed.data.endDate) data.endDate = new Date(parsed.data.endDate);

  const plan = await prisma.dietPlan.create({ data: data as never });
  return createdResponse(plan);
}
