import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, errorResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("pharmacy", "view");
  if (error) return error;

  const { id } = await params;
  const drug = await prisma.drug.findUnique({ where: { id } });
  if (!drug) return errorResponse("Drug not found", 404);
  return successResponse(drug);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("pharmacy", "edit");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const drug = await prisma.drug.update({ where: { id }, data: body });
  return successResponse(drug);
}
