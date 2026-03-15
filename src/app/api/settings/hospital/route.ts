import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("settings", "view");
  if (error) return error;

  const hospital = await prisma.hospital.findFirst();
  return successResponse(hospital);
}

export async function PUT(req: NextRequest) {
  const { error } = await requireAuth("settings", "edit");
  if (error) return error;

  const body = await req.json();
  const hospital = await prisma.hospital.upsert({ where: { id: "default-hospital" }, update: body, create: { id: "default-hospital", ...body } });
  return successResponse(hospital);
}
