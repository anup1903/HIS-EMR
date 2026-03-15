import { z } from "zod";

export const insuranceProviderCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  type: z.enum(["TPA", "DIRECT", "GOVERNMENT"]),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  panelRate: z.number().optional().nullable(),
});

export const insurancePolicyCreateSchema = z.object({
  patientId: z.string().min(1),
  providerId: z.string().min(1),
  policyNumber: z.string().min(1),
  groupNumber: z.string().optional().nullable(),
  membershipId: z.string().optional().nullable(),
  holderName: z.string().min(1),
  relationship: z.string().default("SELF"),
  coverageType: z.enum(["INDIVIDUAL", "FAMILY", "GROUP"]),
  coverageAmount: z.number().min(0),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  copayPercentage: z.number().optional().nullable(),
  deductible: z.number().optional().nullable(),
});

export const insuranceClaimCreateSchema = z.object({
  patientId: z.string().min(1),
  providerId: z.string().min(1),
  policyId: z.string().min(1),
  invoiceId: z.string().optional().nullable(),
  admissionId: z.string().optional().nullable(),
  claimType: z.enum(["PRE_AUTH", "CASHLESS", "REIMBURSEMENT"]),
  claimAmount: z.number().min(0),
  diagnosis: z.string().min(1),
  treatmentDetails: z.string().optional().nullable(),
  admissionDate: z.string().optional().nullable(),
  dischargeDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type InsuranceProviderInput = z.infer<typeof insuranceProviderCreateSchema>;
export type InsurancePolicyInput = z.infer<typeof insurancePolicyCreateSchema>;
export type InsuranceClaimInput = z.infer<typeof insuranceClaimCreateSchema>;
