import { z } from "zod";

export const bloodDonorCreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  bloodGroup: z.enum(["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"]),
  phone: z.string().min(1),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
});

export const bloodDonationCreateSchema = z.object({
  donorId: z.string().min(1),
  bloodGroup: z.enum(["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"]),
  volumeML: z.number().int().default(450),
  hemoglobin: z.number().optional().nullable(),
  bloodPressure: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const bloodRequestCreateSchema = z.object({
  patientId: z.string().min(1),
  bloodGroup: z.enum(["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"]),
  component: z.enum(["WHOLE_BLOOD", "PACKED_RBC", "PLATELET", "PLASMA", "CRYOPRECIPITATE"]).default("WHOLE_BLOOD"),
  unitsRequired: z.number().int().min(1),
  reason: z.string().min(1),
  urgency: z.enum(["STAT", "URGENT", "ROUTINE"]).default("ROUTINE"),
  requiredDate: z.string().min(1),
  notes: z.string().optional().nullable(),
});
