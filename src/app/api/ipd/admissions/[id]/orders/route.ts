import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, createdResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("ipd", "view");
  if (error) return error;

  const { id } = await params;
  const orders = await prisma.doctorOrder.findMany({ where: { admissionId: id }, orderBy: { orderedAt: "desc" } });
  return successResponse(orders);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth("ipd", "create");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const order = await prisma.doctorOrder.create({ data: { admissionId: id, orderType: body.orderType, description: body.description, priority: body.priority || "ROUTINE", orderedBy: session!.user.id, notes: body.notes } });
  return createdResponse(order);
}
