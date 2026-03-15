import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { surgeryCreateSchema } from "@/lib/validations/surgery";
import { generateSurgeryNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("ipd", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = searchParams.get("status");
  const date = searchParams.get("date");
  const otId = searchParams.get("otId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (otId) where.otId = otId;
  if (date) where.scheduledDate = { gte: new Date(date), lt: new Date(new Date(date).getTime() + 86400000) };

  const [surgeries, total] = await Promise.all([
    prisma.surgery.findMany({ where: where as never, skip, take: limit, orderBy: { scheduledDate: "asc" }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } }, theatre: { select: { name: true, code: true } }, teamMembers: true } }),
    prisma.surgery.count({ where: where as never }),
  ]);
  return successResponse(surgeries, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("ipd", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = surgeryCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const surgeryNo = await generateSurgeryNo();
  const { teamMembers, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest, surgeryNo, createdBy: session!.user.id, scheduledDate: new Date(rest.scheduledDate) };
  if (teamMembers && teamMembers.length > 0) {
    data.teamMembers = { create: teamMembers };
  }

  const surgery = await prisma.surgery.create({ data: data as never, include: { teamMembers: true } });
  return createdResponse(surgery);
}
