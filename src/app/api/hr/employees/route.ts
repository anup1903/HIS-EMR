import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { employeeCreateSchema } from "@/lib/validations/hr";
import { generateEmployeeNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("hr", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({ where: { isActive: true }, skip, take: limit, orderBy: { createdAt: "desc" }, include: { user: { select: { name: true, email: true, role: true } }, department: { select: { name: true } } } }),
    prisma.employee.count({ where: { isActive: true } }),
  ]);

  return successResponse(employees, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("hr", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = employeeCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const employeeNo = await generateEmployeeNo();
  const employee = await prisma.employee.create({
    data: { ...parsed.data, employeeNo, dateOfJoining: new Date(parsed.data.dateOfJoining) },
  });

  return createdResponse(employee);
}
