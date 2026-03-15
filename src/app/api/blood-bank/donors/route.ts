import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { bloodDonorCreateSchema } from "@/lib/validations/blood-bank";
import { generateDonorNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("laboratory", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const bloodGroup = searchParams.get("bloodGroup");

  const where: Record<string, unknown> = { isActive: true };
  if (bloodGroup) where.bloodGroup = bloodGroup;

  const [donors, total] = await Promise.all([
    prisma.bloodDonor.findMany({ where: where as never, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.bloodDonor.count({ where: where as never }),
  ]);
  return successResponse(donors, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("laboratory", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = bloodDonorCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const donorNo = await generateDonorNo();
  const data: Record<string, unknown> = { ...parsed.data, donorNo, dateOfBirth: new Date(parsed.data.dateOfBirth) };
  const donor = await prisma.bloodDonor.create({ data: data as never });
  return createdResponse(donor);
}
