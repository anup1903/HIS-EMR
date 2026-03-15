import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { therapySessionCreateSchema } from "@/lib/validations/physiotherapy";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("opd", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const planId = searchParams.get("planId");
  const date = searchParams.get("date");

  const where: Record<string, unknown> = {};
  if (planId) where.therapyPlanId = planId;
  if (date) where.sessionDate = { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) };

  const sessions = await prisma.therapySession.findMany({ where: where as never, orderBy: { sessionDate: "desc" }, include: { therapyPlan: { include: { patient: { select: { firstName: true, lastName: true, mrn: true } } } } } });
  return successResponse(sessions);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("opd", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = therapySessionCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const plan = await prisma.therapyPlan.findUnique({ where: { id: parsed.data.therapyPlanId } });
  if (!plan) return errorResponse("Therapy plan not found", 404);

  const sessionNo = plan.completedSessions + 1;
  const data: Record<string, unknown> = { ...parsed.data, sessionNo, performedBy: session!.user.id, sessionDate: new Date(parsed.data.sessionDate) };

  const [therapySession] = await Promise.all([
    prisma.therapySession.create({ data: data as never }),
    prisma.therapyPlan.update({ where: { id: parsed.data.therapyPlanId }, data: { completedSessions: { increment: 1 } } }),
  ]);
  return createdResponse(therapySession);
}
