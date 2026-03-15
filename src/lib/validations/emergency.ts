import { z } from "zod";

export const emergencyVisitCreateSchema = z.object({
  patientId: z.string().optional().nullable(),
  walkInName: z.string().optional().nullable(),
  walkInAge: z.number().int().optional().nullable(),
  walkInGender: z.string().optional().nullable(),
  walkInPhone: z.string().optional().nullable(),
  arrivalMode: z.enum(["WALK_IN", "AMBULANCE", "POLICE", "REFERRED"]).default("WALK_IN"),
  triageLevel: z.enum(["RESUSCITATION", "EMERGENT", "URGENT", "LESS_URGENT", "NON_URGENT"]).default("URGENT"),
  triageNotes: z.string().optional().nullable(),
  chiefComplaint: z.string().min(1, "Chief complaint is required"),
  injuryType: z.string().optional().nullable(),
  vitalSigns: z.string().optional().nullable(),
  consciousnessLevel: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const emergencyUpdateSchema = z.object({
  triageLevel: z.enum(["RESUSCITATION", "EMERGENT", "URGENT", "LESS_URGENT", "NON_URGENT"]).optional(),
  primaryAssessment: z.string().optional().nullable(),
  treatmentGiven: z.string().optional().nullable(),
  diagnosis: z.string().optional().nullable(),
  disposition: z.string().optional(),
  isStabilized: z.boolean().optional(),
  attendingDoctorId: z.string().optional().nullable(),
  bedAssigned: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type EmergencyVisitInput = z.infer<typeof emergencyVisitCreateSchema>;
