import { z } from "zod";

export const employeeCreateSchema = z.object({
  userId: z.string().min(1),
  departmentId: z.string().min(1),
  designation: z.string().min(1),
  dateOfJoining: z.string().min(1),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT"]).default("FULL_TIME"),
  salary: z.number().min(0),
  bankName: z.string().optional().nullable(),
  bankAccountNo: z.string().optional().nullable(),
  panNumber: z.string().optional().nullable(),
});

export const leaveRequestSchema = z.object({
  leaveType: z.enum(["CASUAL", "SICK", "EARNED", "MATERNITY", "UNPAID"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  totalDays: z.number().int().min(1),
  reason: z.string().min(1),
});

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type LeaveRequestInput = z.infer<typeof leaveRequestSchema>;
