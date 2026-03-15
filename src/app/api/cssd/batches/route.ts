import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { sterilizationBatchCreateSchema } from "@/lib/validations/cssd";
import { generateBatchNo } from "@/lib/helpers/id-generator";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("inventory", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [batches, total] = await Promise.all([
    prisma.sterilizationBatch.findMany({ where: where as never, skip, take: limit, orderBy: { createdAt: "desc" }, include: { instrumentSet: { select: { name: true, code: true } } } }),
    prisma.sterilizationBatch.count({ where: where as never }),
  ]);
  return successResponse(batches, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("inventory", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = sterilizationBatchCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const batchNo = await generateBatchNo();
  const data: Record<string, unknown> = { ...parsed.data, batchNo, processedBy: session!.user.id };
  const batch = await prisma.sterilizationBatch.create({ data: data as never });
  return createdResponse(batch);
}
