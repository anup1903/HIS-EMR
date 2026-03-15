import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("reports", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : new Date();

  const [newPatients, appointments, admissions, genderDistribution] = await Promise.all([
    prisma.patient.count({ where: { createdAt: { gte: from, lte: to }, deletedAt: null } }),
    prisma.appointment.count({ where: { date: { gte: from, lte: to } } }),
    prisma.admission.count({ where: { admissionDate: { gte: from, lte: to } } }),
    prisma.patient.groupBy({ by: ["gender"], where: { deletedAt: null }, _count: true }),
  ]);

  return successResponse({ newPatients, appointments, admissions, genderDistribution });
}
