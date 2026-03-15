import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("reports", "view");
  if (error) return error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

  const [
    totalPatients, newPatientsToday, newPatientsThisMonth, newPatientsLastMonth,
    todayAppointments, activeBeds, totalBeds,
    activeAdmissions, pendingLabOrders, pendingRadOrders,
    monthlyRevenue, lastMonthRevenue,
    todayEmergencyVisits, pendingInsuranceClaims,
    scheduledSurgeries, pendingPharmacy,
    departmentStats
  ] = await Promise.all([
    prisma.patient.count({ where: { isActive: true } }),
    prisma.patient.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    prisma.patient.count({ where: { createdAt: { gte: thisMonth } } }),
    prisma.patient.count({ where: { createdAt: { gte: lastMonth, lt: lastMonthEnd } } }),
    prisma.appointment.count({ where: { date: { gte: today, lt: tomorrow } } }),
    prisma.bed.count({ where: { status: "OCCUPIED" } }),
    prisma.bed.count(),
    prisma.admission.count({ where: { status: "ADMITTED" } }),
    prisma.labOrder.count({ where: { status: "PENDING" } }),
    prisma.radiologyOrder.count({ where: { status: "PENDING" } }),
    prisma.invoice.aggregate({ where: { createdAt: { gte: thisMonth }, status: { in: ["PAID", "PARTIALLY_PAID"] } }, _sum: { paidAmount: true } }),
    prisma.invoice.aggregate({ where: { createdAt: { gte: lastMonth, lt: thisMonth }, status: { in: ["PAID", "PARTIALLY_PAID"] } }, _sum: { paidAmount: true } }),
    prisma.emergencyVisit.count({ where: { arrivalTime: { gte: today, lt: tomorrow } } }).catch(() => 0),
    prisma.insuranceClaim.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }).catch(() => 0),
    prisma.surgery.count({ where: { status: "SCHEDULED", scheduledDate: { gte: today } } }).catch(() => 0),
    prisma.prescription.count({ where: { status: "PENDING" } }),
    prisma.department.findMany({ where: { isActive: true }, select: { name: true, _count: { select: { doctors: true, employees: true } } }, orderBy: { name: "asc" } }),
  ]);

  const currentRevenue = Number(monthlyRevenue._sum.paidAmount || 0);
  const prevRevenue = Number(lastMonthRevenue._sum.paidAmount || 0);
  const revenueGrowth = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue * 100) : 0;
  const patientGrowth = newPatientsLastMonth > 0 ? ((newPatientsThisMonth - newPatientsLastMonth) / newPatientsLastMonth * 100) : 0;

  return successResponse({
    overview: {
      totalPatients, newPatientsToday, newPatientsThisMonth, patientGrowth: Math.round(patientGrowth),
      todayAppointments, activeAdmissions,
      bedOccupancy: totalBeds > 0 ? Math.round((activeBeds / totalBeds) * 100) : 0,
      occupiedBeds: activeBeds, totalBeds,
    },
    clinical: {
      pendingLabOrders, pendingRadOrders, pendingPharmacy,
      todayEmergencyVisits, scheduledSurgeries, pendingInsuranceClaims,
    },
    financial: {
      monthlyRevenue: currentRevenue, revenueGrowth: Math.round(revenueGrowth),
    },
    departments: departmentStats,
  });
}
