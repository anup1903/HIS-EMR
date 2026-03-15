import { prisma } from "@/lib/prisma";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function generateMRN(): Promise<string> {
  const count = await prisma.patient.count({
    where: { createdAt: { gte: startOfToday() } },
  });
  return `MRN-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateAppointmentNo(): Promise<string> {
  const count = await prisma.appointment.count({
    where: { createdAt: { gte: startOfToday() } },
  });
  return `APT-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateConsultationNo(): Promise<string> {
  const count = await prisma.consultation.count({
    where: { createdAt: { gte: startOfToday() } },
  });
  return `CON-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateAdmissionNo(): Promise<string> {
  const count = await prisma.admission.count({
    where: { createdAt: { gte: startOfToday() } },
  });
  return `ADM-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateInvoiceNo(): Promise<string> {
  const count = await prisma.invoice.count({
    where: { createdAt: { gte: startOfToday() } },
  });
  return `INV-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generatePaymentNo(): Promise<string> {
  const count = await prisma.payment.count({
    where: { paidAt: { gte: startOfToday() } },
  });
  return `PAY-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generatePrescriptionNo(): Promise<string> {
  const count = await prisma.prescription.count({
    where: { createdAt: { gte: startOfToday() } },
  });
  return `PRE-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateLabOrderNo(): Promise<string> {
  const count = await prisma.labOrder.count({
    where: { createdAt: { gte: startOfToday() } },
  });
  return `LAB-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateRadiologyOrderNo(): Promise<string> {
  const count = await prisma.radiologyOrder.count({
    where: { createdAt: { gte: startOfToday() } },
  });
  return `RAD-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generatePONumber(): Promise<string> {
  const count = await prisma.purchaseOrder.count({
    where: { createdAt: { gte: startOfToday() } },
  });
  return `PO-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateEmployeeNo(): Promise<string> {
  const count = await prisma.employee.count();
  return `EMP-${String(count + 1).padStart(4, "0")}`;
}

export async function generateMedicalRecordNo(): Promise<string> {
  const count = await prisma.medicalRecord.count({ where: { createdAt: { gte: startOfToday() } } });
  return `EMR-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateClaimNo(): Promise<string> {
  const count = await prisma.insuranceClaim.count({ where: { createdAt: { gte: startOfToday() } } });
  return `CLM-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generatePreAuthNo(): Promise<string> {
  const count = await prisma.preAuthorization.count({ where: { createdAt: { gte: startOfToday() } } });
  return `PRA-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateSurgeryNo(): Promise<string> {
  const count = await prisma.surgery.count({ where: { createdAt: { gte: startOfToday() } } });
  return `SUR-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateEmergencyVisitNo(): Promise<string> {
  const count = await prisma.emergencyVisit.count({ where: { createdAt: { gte: startOfToday() } } });
  return `EMG-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateDonorNo(): Promise<string> {
  const count = await prisma.bloodDonor.count();
  return `DNR-${String(count + 1).padStart(4, "0")}`;
}

export async function generateDonationNo(): Promise<string> {
  const count = await prisma.bloodDonation.count({ where: { createdAt: { gte: startOfToday() } } });
  return `DON-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateBloodRequestNo(): Promise<string> {
  const count = await prisma.bloodRequest.count({ where: { createdAt: { gte: startOfToday() } } });
  return `BLR-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateTeleconsultNo(): Promise<string> {
  const count = await prisma.teleconsultSession.count({ where: { createdAt: { gte: startOfToday() } } });
  return `TLC-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateBatchNo(): Promise<string> {
  const count = await prisma.sterilizationBatch.count({ where: { createdAt: { gte: startOfToday() } } });
  return `STR-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateDispatchNo(): Promise<string> {
  const count = await prisma.ambulanceDispatch.count({ where: { createdAt: { gte: startOfToday() } } });
  return `DSP-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateTherapyPlanNo(): Promise<string> {
  const count = await prisma.therapyPlan.count({ where: { createdAt: { gte: startOfToday() } } });
  return `PHY-${todayStr()}-${String(count + 1).padStart(4, "0")}`;
}
