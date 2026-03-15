import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { createdResponse, errorResponse } from "@/lib/helpers/api-response";
import { vitalsCreateSchema } from "@/lib/validations/consultation";

export async function POST(req: NextRequest) {
  const { error, session } = await requireAuth("opd", "edit");
  if (error) return error;

  const body = await req.json();
  const parsed = vitalsCreateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0].message, 422);

  const weight = parsed.data.weight;
  const height = parsed.data.height;
  let bmi: number | null = null;
  if (weight && height && height > 0) {
    bmi = Math.round((weight / ((height / 100) ** 2)) * 10) / 10;
  }

  const vitals = await prisma.vitals.create({
    data: { ...parsed.data, bmi, recordedBy: session!.user.id } as never,
  });

  return createdResponse(vitals);
}
