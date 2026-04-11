import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, errorResponse } from "@/lib/helpers/api-response";
import { checkPanel, hasCriticalAlert } from "@/lib/cds/critical-values";

const schema = z.object({
  patientId: z.string().optional(),
  labOrderId: z.string().optional(),
  results: z
    .array(
      z.object({
        code: z.string().min(1),
        value: z.number(),
        unit: z.string().optional(),
      }),
    )
    .min(1),
  /** Optional patient demographics (for age/sex-aware thresholds in the future). */
  ageYears: z.number().optional(),
  sex: z.string().optional(),
});

/**
 * POST /api/cds/critical-check
 * Body: { results: [{ code, value, unit? }, ...], patientId?, labOrderId? }
 *
 * Returns a list of critical-value alerts. The caller (lab UI, nurse station)
 * should display them inline and escalate to the ordering provider via the
 * existing notification/SSE pipeline when `hasCritical === true`.
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAuth("laboratory", "view");
  if (error) return error;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0].message, 422);
  }

  const { results, ageYears, sex } = parsed.data;

  const alerts = checkPanel(
    results.map((r) => ({ ...r, ageYears, sex })),
  );

  return successResponse({
    alerts,
    hasCritical: hasCriticalAlert(alerts),
    checkedAt: new Date().toISOString(),
  });
}
