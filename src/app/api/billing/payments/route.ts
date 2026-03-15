import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { paymentCreateSchema } from "@/lib/validations/billing";
import { generatePaymentNo } from "@/lib/helpers/id-generator";

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("billing", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = paymentCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const paymentNo = await generatePaymentNo();
  const payment = await prisma.$transaction(async (tx) => {
    const pay = await tx.payment.create({ data: { paymentNo, invoiceId: parsed.data.invoiceId, amount: parsed.data.amount, method: parsed.data.method, referenceNo: parsed.data.referenceNo, receivedBy: session!.user.id, notes: parsed.data.notes } });

    const invoice = await tx.invoice.findUnique({ where: { id: parsed.data.invoiceId } });
    if (invoice) {
      const newPaidAmount = Number(invoice.paidAmount) + parsed.data.amount;
      const newBalance = Number(invoice.totalAmount) - newPaidAmount;
      const newStatus = newBalance <= 0 ? "PAID" : "PARTIALLY_PAID";
      await tx.invoice.update({ where: { id: invoice.id }, data: { paidAmount: newPaidAmount, balanceAmount: Math.max(0, newBalance), status: newStatus } });
    }
    return pay;
  });

  return createdResponse(payment);
}
