import { z } from "zod";

export const patientCreateSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  bloodGroup: z.enum(["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"]).optional().nullable(),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]).optional().nullable(),
  phone: z.string().min(1, "Phone number is required").max(20),
  email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "ZIP code is required"),
  emergencyName: z.string().optional().nullable(),
  emergencyPhone: z.string().optional().nullable(),
  emergencyRelation: z.string().optional().nullable(),
  insuranceProvider: z.string().optional().nullable(),
  insurancePolicyNo: z.string().optional().nullable(),
  allergies: z.string().optional().nullable(),
  chronicConditions: z.string().optional().nullable(),
});

export const patientUpdateSchema = patientCreateSchema.partial();
export type PatientCreateInput = z.infer<typeof patientCreateSchema>;
export type PatientUpdateInput = z.infer<typeof patientUpdateSchema>;
