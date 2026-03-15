import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { dispatchCreateSchema } from "@/lib/validations/ambulance";
import { generateDispatchNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("patients", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [dispatches, total] = await Promise.all([
    prisma.ambulanceDispatch.findMany({ where: where as never, skip, take: limit, orderBy: { callTime: "desc" }, include: { ambulance: { select: { vehicleNumber: true, type: true, driverName: true } } } }),
    prisma.ambulanceDispatch.count({ where: where as never }),
  ]);
  return successResponse(dispatches, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("patients", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = dispatchCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const dispatchNo = await generateDispatchNo();
  const dispatch = await prisma.$transaction(async (tx) => {
    await tx.ambulance.update({ where: { id: parsed.data.ambulanceId }, data: { status: "DISPATCHED" } });
    return tx.ambulanceDispatch.create({ data: { ...parsed.data, dispatchNo, dispatchedBy: session!.user.id, dispatchTime: new Date() } as never });
  });
  return createdResponse(dispatch);
}
