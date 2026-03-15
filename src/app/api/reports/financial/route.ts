import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("reports", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : new Date();

  const [invoices, payments] = await Promise.all([
    prisma.invoice.aggregate({ where: { createdAt: { gte: from, lte: to } }, _sum: { totalAmount: true, paidAmount: true, balanceAmount: true }, _count: true }),
    prisma.payment.groupBy({ by: ["method"], where: { paidAt: { gte: from, lte: to } }, _sum: { amount: true }, _count: true }),
  ]);

  return successResponse({ invoices, paymentsByMethod: payments });
}
