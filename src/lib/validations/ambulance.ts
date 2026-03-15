import { z } from "zod";

export const ambulanceCreateSchema = z.object({
  vehicleNumber: z.string().min(1),
  type: z.enum(["BLS", "ALS", "PATIENT_TRANSPORT", "NEONATAL"]),
  make: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  year: z.number().int().optional().nullable(),
  driverName: z.string().optional().nullable(),
  driverPhone: z.string().optional().nullable(),
  paramedicName: z.string().optional().nullable(),
  paramedicPhone: z.string().optional().nullable(),
});

export const dispatchCreateSchema = z.object({
  ambulanceId: z.string().min(1),
  patientName: z.string().optional().nullable(),
  patientPhone: z.string().optional().nullable(),
  pickupAddress: z.string().min(1),
  dropAddress: z.string().optional().nullable(),
  tripType: z.enum(["EMERGENCY", "TRANSFER", "PICKUP", "RETURN"]).default("EMERGENCY"),
  priority: z.enum(["CRITICAL", "URGENT", "ROUTINE"]).default("URGENT"),
  chiefComplaint: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
