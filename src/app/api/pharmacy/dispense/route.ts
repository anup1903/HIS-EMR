import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("pharmacy", "view");
  if (error) return error;

  const prescriptions = await prisma.prescription.findMany({
    where: { status: "PENDING", dispensing: null },
    include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } }, items: { include: { drug: true } } },
    orderBy: { createdAt: "asc" },
  });

  return successResponse(prescriptions);
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("pharmacy", "edit");
  if (error) return error;

  const body = await req.json();
  const { prescriptionId } = body;
  if (!prescriptionId) return errorResponse("prescriptionId is required");

  const result = await prisma.$transaction(async (tx) => {
    const prescription = await tx.prescription.findUnique({ where: { id: prescriptionId }, include: { items: true } });
    if (!prescription) throw new Error("Prescription not found");

    for (const item of prescription.items) {
      await tx.drug.update({ where: { id: item.drugId }, data: { stockQuantity: { decrement: item.quantity } } });
    }

    await tx.prescription.update({ where: { id: prescriptionId }, data: { status: "COMPLETED" } });
    return tx.dispensing.create({ data: { prescriptionId, dispensedBy: session!.user.id } });
  });

  return createdResponse(result);
}
