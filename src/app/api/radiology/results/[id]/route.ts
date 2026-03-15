import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse } from "@/lib/helpers/api-response";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth("radiology", "edit");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const item = await prisma.radiologyOrderItem.update({
    where: { id },
    data: { findings: body.findings, impression: body.impression, conclusion: body.conclusion, performedBy: session!.user.id, performedAt: new Date(), reportedBy: session!.user.id, reportedAt: new Date(), status: "COMPLETED", notes: body.notes },
  });

  const order = await prisma.radiologyOrder.findFirst({ where: { items: { some: { id } } }, include: { items: true } });
  if (order) {
    const allCompleted = order.items.every((i) => i.id === id ? true : i.status === "COMPLETED");
    if (allCompleted) await prisma.radiologyOrder.update({ where: { id: order.id }, data: { status: "COMPLETED" } });
    else await prisma.radiologyOrder.update({ where: { id: order.id }, data: { status: "IN_PROGRESS" } });
  }

  return successResponse(item);
}
