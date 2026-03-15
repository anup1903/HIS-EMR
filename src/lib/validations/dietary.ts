import { z } from "zod";

export const dietPlanCreateSchema = z.object({
  patientId: z.string().min(1),
  admissionId: z.string().optional().nullable(),
  dietType: z.enum(["REGULAR", "DIABETIC", "LOW_SODIUM", "RENAL", "LIQUID", "SOFT", "NPO", "CUSTOM"]),
  allergies: z.string().optional().nullable(),
  restrictions: z.string().optional().nullable(),
  calories: z.number().int().optional().nullable(),
  proteinGrams: z.number().int().optional().nullable(),
  carbGrams: z.number().int().optional().nullable(),
  fatGrams: z.number().int().optional().nullable(),
  specialInstructions: z.string().optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
});

export const mealOrderCreateSchema = z.object({
  dietPlanId: z.string().min(1),
  mealType: z.enum(["BREAKFAST", "LUNCH", "SNACK", "DINNER"]),
  date: z.string().min(1),
  items: z.string().min(1), // JSON
  specialNotes: z.string().optional().nullable(),
});
