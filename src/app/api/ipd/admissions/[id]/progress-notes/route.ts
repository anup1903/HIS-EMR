import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, createdResponse, errorResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth("ipd", "view");
  if (error) return error;

  const { id } = await params;
  const notes = await prisma.progressNote.findMany({ where: { admissionId: id }, orderBy: { recordedAt: "desc" } });
  return successResponse(notes);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth("ipd", "edit");
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const note = await prisma.progressNote.create({ data: { admissionId: id, note: body.note, type: body.type || "PROGRESS", recordedBy: session!.user.id } });
  return createdResponse(note);
}
