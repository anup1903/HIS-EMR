import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { registerSchema } from "@/lib/validations/auth";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("settings", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where: { deletedAt: null }, skip, take: limit, orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, role: true, isActive: true, phone: true, createdAt: true } }),
    prisma.user.count({ where: { deletedAt: null } }),
  ]);

  return successResponse(users, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth("settings", "create");
  if (error) return error;

  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return errorResponse("Email already exists", 409);

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: { ...parsed.data, password: hashedPassword },
    select: { id: true, name: true, email: true, role: true },
  });

  return createdResponse(user);
}
