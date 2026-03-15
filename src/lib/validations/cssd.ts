import { z } from "zod";

export const instrumentSetCreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  department: z.string().optional().nullable(),
  items: z.string().min(1), // JSON
  totalItems: z.number().int().min(1),
});

export const sterilizationBatchCreateSchema = z.object({
  instrumentSetId: z.string().min(1),
  method: z.enum(["AUTOCLAVE", "ETO", "PLASMA", "CHEMICAL"]),
  cycleNumber: z.string().optional().nullable(),
  machineId: z.string().optional().nullable(),
  temperature: z.number().optional().nullable(),
  pressure: z.number().optional().nullable(),
  duration: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
});
