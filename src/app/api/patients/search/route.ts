import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("patients", "view");
  if (error) return error;

  const q = new URL(req.url).searchParams.get("q") || "";
  if (q.length < 2) return successResponse([]);

  const patients = await prisma.patient.findMany({
    where: {
      deletedAt: null,
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { mrn: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    select: { id: true, mrn: true, firstName: true, lastName: true, phone: true, gender: true, dateOfBirth: true },
    take: 10,
    orderBy: { firstName: "asc" },
  });

  return successResponse(patients);
}
