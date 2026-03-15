import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("hr", "view");
  if (error) return error;

  const payrollRuns = await prisma.payrollRun.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }], include: { _count: { select: { payslips: true } } } });
  return successResponse(payrollRuns);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("hr", "create");
  if (error) return error;

  const body = await req.json();
  const { month, year } = body;

  const employees = await prisma.employee.findMany({ where: { isActive: true } });

  let totalAmount = 0;
  const payslipData = employees.map((emp) => {
    const netSalary = Number(emp.salary);
    totalAmount += netSalary;
    return { employeeId: emp.id, basicSalary: emp.salary, netSalary: emp.salary, workingDays: 22, presentDays: 22 };
  });

  const payrollRun = await prisma.payrollRun.create({
    data: { month, year, totalAmount, processedBy: session!.user.id, processedAt: new Date(), status: "PROCESSED", payslips: { create: payslipData } },
    include: { payslips: true },
  });

  return createdResponse(payrollRun);
}
