import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse } from "@/lib/helpers/api-response";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth("laboratory", "view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const bloodGroup = searchParams.get("bloodGroup");
  const component = searchParams.get("component");
  const status = searchParams.get("status") || "AVAILABLE";

  const where: Record<string, unknown> = { status };
  if (bloodGroup) where.bloodGroup = bloodGroup;
  if (component) where.component = component;

  const inventory = await prisma.bloodInventory.findMany({ where: where as never, orderBy: { expiryDate: "asc" }, include: { donation: { select: { donationNo: true, donor: { select: { firstName: true, lastName: true } } } } } });

  // Summary by blood group
  const summary = await prisma.bloodInventory.groupBy({ by: ["bloodGroup", "component"], where: { status: "AVAILABLE" }, _count: true, _sum: { volumeML: true } });

  return successResponse({ inventory, summary });
}
