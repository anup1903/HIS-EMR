import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { ambulanceCreateSchema } from "@/lib/validations/ambulance";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("patients", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { isActive: true };
  if (status) where.status = status;

  const vehicles = await prisma.ambulance.findMany({ where: where as never, orderBy: { vehicleNumber: "asc" }, include: { _count: { select: { dispatches: true } } } });
  return successResponse(vehicles);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("settings", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = ambulanceCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const vehicle = await prisma.ambulance.create({ data: parsed.data as never });
  return createdResponse(vehicle);
}
