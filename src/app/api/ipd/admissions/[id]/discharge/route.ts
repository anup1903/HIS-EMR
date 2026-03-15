import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, errorResponse } from "@/lib/helpers/api-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("ipd", "edit");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const admission = await prisma.$transaction(async (tx) => {
    const adm = await tx.admission.update({
      where: { id },
      data: { status: "DISCHARGED", dischargeDate: new Date(), dischargeSummary: body.dischargeSummary, dischargeNotes: body.dischargeNotes },
    });
    await tx.bed.update({ where: { id: adm.bedId }, data: { status: "AVAILABLE" } });
    return adm;
  });

  return successResponse(admission);
}
