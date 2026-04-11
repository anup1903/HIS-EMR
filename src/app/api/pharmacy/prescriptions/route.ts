import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import {
  successResponse,
  createdResponse,
  errorResponse,
} from "@/lib/helpers/api-response";
import { prescriptionCreateSchema } from "@/lib/validations/pharmacy";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("pharmacy", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = searchParams.get("status");
  const patientId = searchParams.get("patientId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (patientId) where.patientId = patientId;

  const [items, total] = await Promise.all([
    prisma.prescription.findMany({
      where: where as never,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
        items: { include: { drug: { select: { id: true, name: true, strength: true } } } },
      },
    }),
    prisma.prescription.count({ where: where as never }),
  ]);

  return successResponse(items, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("pharmacy", "view");
  if (error) return error;

  // Doctors, nurses, and admins may write prescriptions.
  const role = (session!.user as { role: string }).role;
  if (!["ADMIN", "DOCTOR", "NURSE"].includes(role)) {
    return errorResponse("Not allowed to write prescriptions", 403);
  }

  const body = await req.json();
  const parsed = prescriptionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0].message, 422);
  }

  const { patientId, consultationId, admissionId, items, notes } = parsed.data;

  // Generate prescription number: RX-YYYYMMDD-####
  const today = new Date();
  const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const todayCount = await prisma.prescription.count({
    where: {
      createdAt: {
        gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      },
    },
  });
  const prescriptionNo = `RX-${yyyymmdd}-${String(todayCount + 1).padStart(4, "0")}`;

  // Verify patient + optional consultation / admission
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) return errorResponse("Patient not found", 404);

  // Verify every drug exists (single query)
  const drugIds = items.map((i) => i.drugId);
  const drugs = await prisma.drug.findMany({
    where: { id: { in: drugIds } },
    select: { id: true },
  });
  if (drugs.length !== new Set(drugIds).size) {
    return errorResponse("One or more drugs not found", 422);
  }

  const rx = await prisma.prescription.create({
    data: {
      prescriptionNo,
      patientId,
      consultationId: consultationId || null,
      admissionId: admissionId || null,
      prescribedBy: session!.user!.name ?? "Unknown",
      notes: notes ?? null,
      status: "PENDING",
      items: {
        create: items.map((it) => ({
          drugId: it.drugId,
          dosage: it.dosage,
          frequency: it.frequency,
          duration: it.duration,
          route: it.route ?? "ORAL",
          instructions: it.instructions ?? null,
          quantity: it.quantity,
        })),
      },
    },
    include: {
      patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
      items: { include: { drug: true } },
    },
  });

  return createdResponse(rx);
}
