import { z } from "zod";

export const labTestCreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional().nullable(),
  sampleType: z.string().min(1),
  normalRange: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  price: z.number().min(0),
  turnaroundTime: z.string().optional().nullable(),
});

export const labOrderCreateSchema = z.object({
  patientId: z.string().min(1),
  consultationId: z.string().optional().nullable(),
  admissionId: z.string().optional().nullable(),
  priority: z.enum(["STAT", "URGENT", "ROUTINE"]).default("ROUTINE"),
  clinicalInfo: z.string().optional().nullable(),
  testIds: z.array(z.string()).min(1, "At least one test is required"),
  notes: z.string().optional().nullable(),
});

export const labResultSchema = z.object({
  result: z.string().optional().nullable(),
  resultValue: z.number().optional().nullable(),
  unit: z.string().optional().nullable(),
  normalRange: z.string().optional().nullable(),
  isAbnormal: z.boolean().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type LabTestCreateInput = z.infer<typeof labTestCreateSchema>;
export type LabOrderCreateInput = z.infer<typeof labOrderCreateSchema>;
