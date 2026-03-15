import { z } from "zod";

export const radiologyOrderCreateSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  consultationId: z.string().optional(),
  admissionId: z.string().optional(),
  examTypeIds: z.array(z.string()).min(1, "At least one exam type is required"),
  clinicalInfo: z.string().optional(),
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]).optional(),
  notes: z.string().optional(),
});

export const radiologyResultSchema = z.object({
  findings: z.string().optional(),
  impression: z.string().optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(),
});

export type RadiologyOrderCreateInput = z.infer<typeof radiologyOrderCreateSchema>;
export type RadiologyResultInput = z.infer<typeof radiologyResultSchema>;
