import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { parsePagination } from "@/lib/helpers/pagination";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("patients", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const patientId = searchParams.get("patientId");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (patientId) where.patientId = patientId;
  if (type) where.type = type;

  const [docs, total] = await Promise.all([
    prisma.patientDocument.findMany({ where: where as never, skip, take: limit, orderBy: { createdAt: "desc" }, include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } } } }),
    prisma.patientDocument.count({ where: where as never }),
  ]);
  return successResponse(docs, { page, limit, total });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("patients", "create");
  if (error) return error;

  const body = await req.json();
  const { patientId, title, type, filePath } = body;
  if (!patientId || !title || !type) return errorResponse("patientId, title, and type are required");

  const doc = await prisma.patientDocument.create({ data: { patientId, title, type, filePath: filePath || "/uploads/placeholder", uploadedBy: session!.user.id } });
  return createdResponse(doc);
}
