import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, errorResponse } from "@/lib/helpers/api-response";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth("laboratory", "edit");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const item = await prisma.labOrderItem.update({
    where: { id },
    data: { result: body.result, resultValue: body.resultValue, unit: body.unit, normalRange: body.normalRange, isAbnormal: body.isAbnormal, performedBy: session!.user.id, performedAt: new Date(), status: "COMPLETED", notes: body.notes },
  });

  // Check if all items in the order are completed
  const order = await prisma.labOrder.findFirst({ where: { items: { some: { id } } }, include: { items: true } });
  if (order) {
    const allCompleted = order.items.every((i) => i.id === id ? true : i.status === "COMPLETED");
    if (allCompleted) await prisma.labOrder.update({ where: { id: order.id }, data: { status: "COMPLETED" } });
    else await prisma.labOrder.update({ where: { id: order.id }, data: { status: "IN_PROGRESS" } });
  }

  return successResponse(item);
}
