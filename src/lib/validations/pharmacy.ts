import { z } from "zod";

export const drugCreateSchema = z.object({
  name: z.string().min(1, "Drug name is required"),
  genericName: z.string().min(1, "Generic name is required"),
  brandName: z.string().optional().nullable(),
  category: z.string().min(1, "Category is required"),
  dosageForm: z.string().min(1, "Dosage form is required"),
  strength: z.string().min(1, "Strength is required"),
  manufacturer: z.string().optional().nullable(),
  batchNumber: z.string().optional().nullable(),
  unitPrice: z.number().min(0),
  sellingPrice: z.number().min(0),
  stockQuantity: z.number().int().min(0).default(0),
  reorderLevel: z.number().int().min(0).default(10),
  expiryDate: z.string().optional().nullable(),
  requiresPrescription: z.boolean().default(true),
});

export const prescriptionItemSchema = z.object({
  drugId: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  duration: z.string().min(1),
  route: z.string().default("ORAL"),
  instructions: z.string().optional().nullable(),
  quantity: z.number().int().min(1),
});

export const prescriptionCreateSchema = z.object({
  patientId: z.string().min(1),
  consultationId: z.string().optional().nullable(),
  admissionId: z.string().optional().nullable(),
  items: z.array(prescriptionItemSchema).min(1),
  notes: z.string().optional().nullable(),
});

export type DrugCreateInput = z.infer<typeof drugCreateSchema>;
export type PrescriptionCreateInput = z.infer<typeof prescriptionCreateSchema>;
