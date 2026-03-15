import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { radiologyOrderCreateSchema } from "@/lib/validations/radiology";
import { generateRadiologyOrderNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("radiology", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = searchParams.get("status");
  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [orders, total] = await Promise.all([
    prisma.radiologyOrder.findMany({ where: where as never, skip, take: limit, orderBy: { createdAt: "desc" }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } }, items: { include: { examType: { include: { modality: true } } } } } }),
    prisma.radiologyOrder.count({ where: where as never }),
  ]);

  return successResponse(orders, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("radiology", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = radiologyOrderCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const orderNo = await generateRadiologyOrderNo();
  const order = await prisma.radiologyOrder.create({
    data: {
      orderNo, patientId: parsed.data.patientId, consultationId: parsed.data.consultationId,
      admissionId: parsed.data.admissionId, orderedBy: session!.user.id,
      priority: parsed.data.priority, clinicalInfo: parsed.data.clinicalInfo, notes: parsed.data.notes,
      items: { create: parsed.data.examTypeIds.map((examTypeId) => ({ examTypeId })) },
    },
    include: { items: { include: { examType: true } } },
  });

  return createdResponse(order);
}
