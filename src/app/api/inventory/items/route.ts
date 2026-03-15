import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { inventoryItemCreateSchema } from "@/lib/validations/inventory";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("inventory", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const search = searchParams.get("search") || "";

  const where: Record<string, unknown> = { isActive: true };
  if (search) where.name = { contains: search, mode: "insensitive" };

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({ where: where as never, skip, take: limit, orderBy: { name: "asc" }, include: { category: true } }),
    prisma.inventoryItem.count({ where: where as never }),
  ]);

  return successResponse(items, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("inventory", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = inventoryItemCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const item = await prisma.inventoryItem.create({ data: parsed.data as never });
  return createdResponse(item);
}
