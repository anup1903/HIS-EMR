import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("radiology", "view");
  if (error) return error;

  const modalities = await prisma.modality.findMany({ where: { isActive: true }, include: { examTypes: { where: { isActive: true } } }, orderBy: { name: "asc" } });
  return successResponse(modalities);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("radiology", "create");
  if (error) return error;

  const body = await req.json();
  const modality = await prisma.modality.create({ data: body });
  return createdResponse(modality);
}
