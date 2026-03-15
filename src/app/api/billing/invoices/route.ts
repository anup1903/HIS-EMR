import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { invoiceCreateSchema } from "@/lib/validations/billing";
import { generateInvoiceNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("billing", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = searchParams.get("status");
  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({ where: where as never, skip, take: limit, orderBy: { createdAt: "desc" }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } }, _count: { select: { items: true, payments: true } } } }),
    prisma.invoice.count({ where: where as never }),
  ]);

  return successResponse(invoices, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("billing", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = invoiceCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const invoiceNo = await generateInvoiceNo();
  const items = parsed.data.items.map((item) => ({ ...item, amount: item.quantity * item.unitPrice }));
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const totalAmount = subtotal + parsed.data.taxAmount - parsed.data.discountAmount;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNo, patientId: parsed.data.patientId, admissionId: parsed.data.admissionId || null,
      subtotal, taxAmount: parsed.data.taxAmount, discountAmount: parsed.data.discountAmount,
      totalAmount, balanceAmount: totalAmount, paidAmount: 0,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      notes: parsed.data.notes, createdBy: session!.user.id, status: "ISSUED",
      items: { create: items },
    },
    include: { items: true },
  });

  return createdResponse(invoice);
}
