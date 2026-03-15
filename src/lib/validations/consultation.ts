import { z } from "zod";

export const consultationCreateSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  doctorId: z.string().min(1, "Doctor is required"),
  appointmentId: z.string().optional().nullable(),
  chiefComplaint: z.string().min(1, "Chief complaint is required"),
  historyOfPresentIllness: z.string().optional().nullable(),
  examination: z.string().optional().nullable(),
  diagnosis: z.string().min(1, "Diagnosis is required"),
  icdCodes: z.string().optional().nullable(),
  treatmentPlan: z.string().optional().nullable(),
  followUpDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const vitalsCreateSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  consultationId: z.string().optional().nullable(),
  admissionId: z.string().optional().nullable(),
  temperature: z.number().optional().nullable(),
  bloodPressureSystolic: z.number().int().optional().nullable(),
  bloodPressureDiastolic: z.number().int().optional().nullable(),
  pulseRate: z.number().int().optional().nullable(),
  respiratoryRate: z.number().int().optional().nullable(),
  oxygenSaturation: z.number().optional().nullable(),
  weight: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type ConsultationCreateInput = z.infer<typeof consultationCreateSchema>;
export type VitalsCreateInput = z.infer<typeof vitalsCreateSchema>;
