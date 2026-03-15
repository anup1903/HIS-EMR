import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { leaveRequestSchema } from "@/lib/validations/hr";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("hr", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = searchParams.get("status");
  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [leaves, total] = await Promise.all([
    prisma.leaveRequest.findMany({ where: where as never, skip, take: limit, orderBy: { createdAt: "desc" }, include: { employee: { include: { user: { select: { name: true } } } } } }),
    prisma.leaveRequest.count({ where: where as never }),
  ]);

  return successResponse(leaves, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("hr", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = leaveRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const employee = await prisma.employee.findUnique({ where: { userId: session!.user.id } });
  if (!employee) return errorResponse("Employee record not found", 404);

  const leave = await prisma.leaveRequest.create({
    data: { ...parsed.data, employeeId: employee.id, startDate: new Date(parsed.data.startDate), endDate: new Date(parsed.data.endDate) },
  });

  return createdResponse(leave);
}
