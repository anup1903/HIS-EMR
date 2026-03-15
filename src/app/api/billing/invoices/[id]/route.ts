import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, errorResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("billing", "view");
  if (error) return error;

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { patient: true, admission: true, items: true, payments: true },
  });
  if (!invoice) return errorResponse("Invoice not found", 404);
  return successResponse(invoice);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("billing", "edit");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const invoice = await prisma.invoice.update({ where: { id }, data: body });
  return successResponse(invoice);
}
