import { z } from "zod";

export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().min(0),
  referenceId: z.string().optional().nullable(),
});

export const invoiceCreateSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  admissionId: z.string().optional().nullable(),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  taxAmount: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  dueDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const paymentCreateSchema = z.object({
  invoiceId: z.string().min(1, "Invoice is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  method: z.enum(["CASH", "CARD", "UPI", "INSURANCE", "BANK_TRANSFER", "CHEQUE"]),
  referenceNo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
