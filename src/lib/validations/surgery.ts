import { z } from "zod";

export const surgeryCreateSchema = z.object({
  patientId: z.string().min(1),
  otId: z.string().min(1),
  primarySurgeonId: z.string().min(1),
  anesthetistId: z.string().optional().nullable(),
  admissionId: z.string().optional().nullable(),
  scheduledDate: z.string().min(1),
  scheduledStartTime: z.string().min(1),
  scheduledEndTime: z.string().min(1),
  surgeryType: z.enum(["ELECTIVE", "EMERGENCY", "DAY_CARE"]),
  procedureName: z.string().min(1),
  procedureCode: z.string().optional().nullable(),
  laterality: z.string().optional().nullable(),
  diagnosis: z.string().min(1),
  anesthesiaType: z.string().optional().nullable(),
  estimatedDuration: z.number().int().optional().nullable(),
  priority: z.string().default("ROUTINE"),
  consentObtained: z.boolean().default(false),
  teamMembers: z.array(z.object({
    userId: z.string().min(1),
    role: z.string().min(1),
  })).optional(),
});

export const otCreateSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  location: z.string().optional().nullable(),
  type: z.string().min(1),
  equipment: z.string().optional().nullable(),
});

export type SurgeryCreateInput = z.infer<typeof surgeryCreateSchema>;
export type OTCreateInput = z.infer<typeof otCreateSchema>;
