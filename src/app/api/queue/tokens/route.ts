import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("appointments", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const serviceType = searchParams.get("serviceType") || "OPD";
  const status = searchParams.get("status");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);

  const where: Record<string, unknown> = { date: { gte: today, lt: tomorrow }, serviceType };
  if (status) where.status = status;

  const tokens = await prisma.queueToken.findMany({ where: where as never, orderBy: [{ priority: "desc" }, { tokenNo: "asc" }], include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } } } });

  const stats = {
    total: tokens.length,
    waiting: tokens.filter(t => t.status === "WAITING").length,
    serving: tokens.filter(t => t.status === "SERVING").length,
    completed: tokens.filter(t => t.status === "COMPLETED").length,
    currentToken: tokens.find(t => t.status === "SERVING")?.tokenNo || null,
  };

  return successResponse({ tokens, stats });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("appointments", "create");
  if (error) return error;

  const body = await req.json();
  const { patientId, patientName, serviceType = "OPD", departmentId, doctorId, priority = "NORMAL" } = body;

  if (!patientId && !patientName) return errorResponse("Patient ID or name is required");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);

  const lastToken = await prisma.queueToken.findFirst({ where: { date: { gte: today, lt: tomorrow }, serviceType }, orderBy: { tokenNo: "desc" } });
  const tokenNo = (lastToken?.tokenNo || 0) + 1;

  // Estimate wait (5 min per waiting token)
  const waitingCount = await prisma.queueToken.count({ where: { date: { gte: today, lt: tomorrow }, serviceType, status: "WAITING" } });

  const token = await prisma.queueToken.create({
    data: { tokenNo, patientId, patientName, serviceType, departmentId, doctorId, priority, estimatedWait: waitingCount * 5, date: today } as never,
  });

  return createdResponse(token);
}
