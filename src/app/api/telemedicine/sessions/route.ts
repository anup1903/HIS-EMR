import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { teleconsultCreateSchema } from "@/lib/validations/telemedicine";
import { generateTeleconsultNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("appointments", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = searchParams.get("status");
  const date = searchParams.get("date");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (date) where.scheduledDate = { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) };

  const [sessions, total] = await Promise.all([
    prisma.teleconsultSession.findMany({ where: where as never, skip, take: limit, orderBy: { scheduledDate: "desc" }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } } } }),
    prisma.teleconsultSession.count({ where: where as never }),
  ]);
  return successResponse(sessions, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("appointments", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = teleconsultCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const sessionNo = await generateTeleconsultNo();
  const data: Record<string, unknown> = { ...parsed.data, sessionNo, scheduledDate: new Date(parsed.data.scheduledDate) };
  const session2 = await prisma.teleconsultSession.create({ data: data as never });
  return createdResponse(session2);
}
