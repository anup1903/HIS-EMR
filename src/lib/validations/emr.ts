import { z } from "zod";

export const medicalRecordCreateSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  visitType: z.enum(["OPD", "IPD", "EMERGENCY"]),
  visitDate: z.string().optional(),
  chiefComplaint: z.string().min(1, "Chief complaint is required"),
  historyOfPresentIllness: z.string().optional().nullable(),
  pastMedicalHistory: z.string().optional().nullable(),
  familyHistory: z.string().optional().nullable(),
  socialHistory: z.string().optional().nullable(),
  reviewOfSystems: z.string().optional().nullable(),
  physicalExamination: z.string().optional().nullable(),
  diagnosis: z.string().min(1, "Diagnosis is required"),
  icdCodes: z.string().optional().nullable(),
  differentialDiagnosis: z.string().optional().nullable(),
  treatmentPlan: z.string().optional().nullable(),
  procedures: z.string().optional().nullable(),
  medications: z.string().optional().nullable(),
  followUpInstructions: z.string().optional().nullable(),
  referralNotes: z.string().optional().nullable(),
  specialty: z.string().optional().nullable(),
  consultationId: z.string().optional().nullable(),
  admissionId: z.string().optional().nullable(),
  emergencyVisitId: z.string().optional().nullable(),
});

export type MedicalRecordCreateInput = z.infer<typeof medicalRecordCreateSchema>;
