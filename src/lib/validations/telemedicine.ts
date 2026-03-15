import { z } from "zod";

export const teleconsultCreateSchema = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  appointmentId: z.string().optional().nullable(),
  scheduledDate: z.string().min(1),
  scheduledTime: z.string().min(1),
  duration: z.number().int().optional().nullable(),
  meetingPlatform: z.enum(["BUILT_IN", "ZOOM", "GOOGLE_MEET", "TEAMS"]).default("BUILT_IN"),
  chiefComplaint: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const teleconsultUpdateSchema = z.object({
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
  prescription: z.string().optional().nullable(),
  diagnosis: z.string().optional().nullable(),
  followUpDate: z.string().optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  feedback: z.string().optional().nullable(),
});
