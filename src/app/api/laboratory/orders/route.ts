import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { labOrderCreateSchema } from "@/lib/validations/laboratory";
import { generateLabOrderNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("laboratory", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = searchParams.get("status");
  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [orders, total] = await Promise.all([
    prisma.labOrder.findMany({ where: where as never, skip, take: limit, orderBy: { createdAt: "desc" }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } }, items: { include: { labTest: true } } } }),
    prisma.labOrder.count({ where: where as never }),
  ]);

  return successResponse(orders, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("laboratory", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = labOrderCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const orderNo = await generateLabOrderNo();
  const order = await prisma.labOrder.create({
    data: {
      orderNo, patientId: parsed.data.patientId, consultationId: parsed.data.consultationId,
      admissionId: parsed.data.admissionId, orderedBy: session!.user.id,
      priority: parsed.data.priority, clinicalInfo: parsed.data.clinicalInfo, notes: parsed.data.notes,
      items: { create: parsed.data.testIds.map((testId) => ({ labTestId: testId })) },
    },
    include: { items: { include: { labTest: true } } },
  });

  return createdResponse(order);
}
