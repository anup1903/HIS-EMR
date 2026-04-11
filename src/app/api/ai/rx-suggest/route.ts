import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { requireAuth } from "@/lib/helpers/rbac";
import { successResponse, errorResponse } from "@/lib/helpers/api-response";

export const runtime = "nodejs";
// Opus may take a few seconds with thinking enabled
export const maxDuration = 60;

/* ─────────── Request schema ─────────── */
const suggestRequestSchema = z.object({
  diagnosis: z.string().min(1, "Diagnosis is required"),
  patient: z.object({
    age: z.number().optional(),
    sex: z.string().optional(),
    weightKg: z.number().optional(),
    allergies: z.string().optional().nullable(),
    chronicConditions: z.string().optional().nullable(),
    pregnant: z.boolean().optional(),
    egfr: z.number().optional(),
  }),
  currentMedications: z.array(z.string()).optional().default([]),
  notes: z.string().optional(),
});

/* ─────────── Structured output schema sent to Claude ─────────── */
const RxSuggestionSchema = z.object({
  reasoning: z
    .string()
    .describe(
      "One or two sentences summarizing the clinical rationale for the suggested regimen.",
    ),
  redFlags: z
    .array(z.string())
    .describe(
      "Any red-flag symptoms or contraindications the prescriber should verify before signing.",
    ),
  suggestions: z
    .array(
      z.object({
        generic: z
          .string()
          .describe("Lowercase generic/INN name, e.g. 'paracetamol'"),
        brandExample: z
          .string()
          .describe("Illustrative brand or trade name."),
        strength: z
          .string()
          .describe("Strength with units, e.g. '500 mg' or '5 mg/mL'"),
        dosageForm: z
          .string()
          .describe("Tablet, Capsule, Syrup, Injection, etc."),
        frequency: z
          .string()
          .describe("Dosing schedule in chart notation, e.g. '1-0-1' or 'SOS'"),
        timing: z
          .string()
          .describe("After food, Before food, Bedtime, Empty stomach, etc."),
        duration: z
          .string()
          .describe("Human duration, e.g. '5 days', '10 days'"),
        route: z
          .string()
          .describe("ORAL, IV, IM, SC, TOP, INH, PR, SUB"),
        rationale: z
          .string()
          .describe("Why this drug is being suggested for THIS patient."),
      }),
    )
    .describe("Ordered list of suggested medications."),
  followUp: z
    .string()
    .describe("Single-line follow-up or review recommendation."),
});

type RxSuggestion = z.infer<typeof RxSuggestionSchema>;

/**
 * POST /api/ai/rx-suggest
 *
 * Generates clinically sensible prescription suggestions for a diagnosis,
 * tailored to the patient's age, sex, allergies, and current meds.
 *
 * Falls back gracefully with a 501 if ANTHROPIC_API_KEY is not configured
 * so the Rx Pad remains fully functional without the AI feature.
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAuth("pharmacy", "view");
  if (error) return error;

  const body = await req.json();
  const parsed = suggestRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0].message, 422);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "AI suggestions disabled. Set ANTHROPIC_API_KEY to enable.",
        code: "AI_DISABLED",
      },
      { status: 501 },
    );
  }

  const { diagnosis, patient, currentMedications, notes } = parsed.data;

  // Build a tight, structured prompt. We include only what the model needs.
  const patientLines = [
    patient.age != null ? `Age: ${patient.age}` : null,
    patient.sex ? `Sex: ${patient.sex}` : null,
    patient.weightKg != null ? `Weight: ${patient.weightKg} kg` : null,
    patient.egfr != null ? `eGFR: ${patient.egfr} mL/min/1.73m²` : null,
    patient.pregnant ? `Pregnant: yes` : null,
    patient.allergies ? `Allergies: ${patient.allergies}` : null,
    patient.chronicConditions
      ? `Chronic conditions: ${patient.chronicConditions}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const currentMedsText =
    currentMedications.length > 0
      ? currentMedications.join(", ")
      : "None recorded";

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.parse({
      model: "claude-opus-4-6",
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      system: [
        "You are a clinical decision support assistant helping a licensed prescriber write a safe, evidence-based prescription.",
        "You DO NOT replace the prescriber — you suggest a first-pass regimen they will review, edit, and sign.",
        "",
        "Rules:",
        "1. Propose a concise regimen (usually 2–5 drugs) targeting the primary diagnosis.",
        "2. Respect allergies, renal function (eGFR), pregnancy, and drug–drug interactions with current medications.",
        "3. Use generic/INN names in lowercase for the `generic` field (e.g. 'paracetamol', 'amoxicillin').",
        "4. Prefer oral route unless the diagnosis clearly warrants IV/IM.",
        "5. Use chart-style frequency notation: 1-0-1, 0-0-1, 1-1-1, SOS, STAT.",
        "6. Duration should be human readable ('5 days', '10 days', '1 month').",
        "7. If the diagnosis is ambiguous or safety-critical (e.g. chest pain, suicidal ideation), return an empty `suggestions` array and explain in `reasoning` why a human must triage first.",
        "8. Always list at least one item in `redFlags` when the diagnosis can mimic a serious condition.",
        "9. Assume the prescriber is in India unless context indicates otherwise.",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [
            `Diagnosis: ${diagnosis}`,
            "",
            "Patient:",
            patientLines || "(no patient details provided)",
            "",
            `Current medications: ${currentMedsText}`,
            notes ? `\nAdditional notes: ${notes}` : "",
            "",
            "Generate a structured prescription suggestion as JSON.",
          ].join("\n"),
        },
      ],
      output_config: {
        format: zodOutputFormat(RxSuggestionSchema),
      },
    });

    const suggestion: RxSuggestion | null = response.parsed_output ?? null;
    if (!suggestion) {
      return errorResponse("AI returned an empty response", 502);
    }

    return successResponse(suggestion);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return errorResponse("Invalid Anthropic API key", 401);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return errorResponse("AI rate-limited — try again shortly", 429);
    }
    if (err instanceof Anthropic.APIError) {
      return errorResponse(`AI error: ${err.message}`, err.status ?? 500);
    }
    console.error("[rx-suggest] unexpected error", err);
    return errorResponse("AI request failed", 500);
  }
}
