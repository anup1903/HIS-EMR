import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { bloodRequestCreateSchema } from "@/lib/validations/blood-bank";
import { generateBloodRequestNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("laboratory", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [requests, total] = await Promise.all([
    prisma.bloodRequest.findMany({ where: where as never, skip, take: limit, orderBy: { createdAt: "desc" }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } } } }),
    prisma.bloodRequest.count({ where: where as never }),
  ]);
  return successResponse(requests, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("laboratory", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = bloodRequestCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const requestNo = await generateBloodRequestNo();
  const data: Record<string, unknown> = { ...parsed.data, requestNo, requestedBy: session!.user.id, requiredDate: new Date(parsed.data.requiredDate) };
  const request = await prisma.bloodRequest.create({ data: data as never });
  return createdResponse(request);
}
