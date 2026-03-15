import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { drugCreateSchema } from "@/lib/validations/pharmacy";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("pharmacy", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const search = searchParams.get("search") || "";
  const lowStock = searchParams.get("lowStock") === "true";

  const where: Record<string, unknown> = { isActive: true };
  if (search) where.OR = [{ name: { contains: search, mode: "insensitive" } }, { genericName: { contains: search, mode: "insensitive" } }];
  if (lowStock) where.stockQuantity = { lte: prisma.drug.fields.reorderLevel };

  const [drugs, total] = await Promise.all([
    prisma.drug.findMany({ where: where as never, skip, take: limit, orderBy: { name: "asc" } }),
    prisma.drug.count({ where: where as never }),
  ]);

  return successResponse(drugs, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("pharmacy", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = drugCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.expiryDate) data.expiryDate = new Date(parsed.data.expiryDate);

  const drug = await prisma.drug.create({ data: data as never });
  return createdResponse(drug);
}
