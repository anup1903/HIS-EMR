import { z } from "zod";

export const therapyPlanCreateSchema = z.object({
  patientId: z.string().min(1),
  referredBy: z.string().optional().nullable(),
  therapistId: z.string().optional().nullable(),
  diagnosis: z.string().min(1),
  condition: z.string().optional().nullable(),
  goals: z.string().optional().nullable(),
  treatmentProtocol: z.string().optional().nullable(),
  frequency: z.string().optional().nullable(),
  totalSessions: z.number().int().optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const therapySessionCreateSchema = z.object({
  therapyPlanId: z.string().min(1),
  sessionDate: z.string().min(1),
  duration: z.number().int().optional().nullable(),
  exercises: z.string().optional().nullable(),
  modalities: z.string().optional().nullable(),
  painLevel: z.number().int().min(0).max(10).optional().nullable(),
  progressNotes: z.string().optional().nullable(),
  outcome: z.enum(["IMPROVED", "SAME", "DECLINED"]).optional().nullable(),
  nextGoals: z.string().optional().nullable(),
});
