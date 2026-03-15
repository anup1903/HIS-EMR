import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { mealOrderCreateSchema } from "@/lib/validations/dietary";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("ipd", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { date: { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) } };
  if (status) where.status = status;

  const meals = await prisma.mealOrder.findMany({ where: where as never, orderBy: { createdAt: "asc" }, include: { dietPlan: { include: { patient: { select: { firstName: true, lastName: true, mrn: true } } } } } });
  return successResponse(meals);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("ipd", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = mealOrderCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const data: Record<string, unknown> = { ...parsed.data, date: new Date(parsed.data.date) };
  const meal = await prisma.mealOrder.create({ data: data as never });
  return createdResponse(meal);
}
