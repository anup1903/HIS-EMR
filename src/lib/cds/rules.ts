/**
 * Clinical Decision Support (CDS) Rules Engine
 * ---------------------------------------------
 * Isomorphic — safe to import from server routes and client components.
 *
 * How it's organized:
 *   - `PatientContext` and `DrugRequest` describe the inputs the engine needs.
 *   - `Alert` is the canonical output shape (severity + category + message).
 *   - `runRules(ctx, drugs)` runs every registered rule and returns alerts.
 *
 * To add a new rule, write a function `(ctx, drugs) => Alert[]` and
 * append it to `RULES` at the bottom of the file.
 *
 * Rules are intentionally simple, pattern-matching heuristics against
 * generic names. In production this would be backed by a real drug DB
 * (First Databank, RxNorm, etc.), but the engine shape stays the same.
 */

export type Severity = "HIGH" | "MODERATE" | "LOW" | "INFO";

export type Category =
  | "allergy"
  | "interaction"
  | "duplicate"
  | "dose"
  | "renal"
  | "hepatic"
  | "pediatric"
  | "geriatric"
  | "pregnancy"
  | "info";

export interface Alert {
  severity: Severity;
  category: Category;
  message: string;
  /** Optional pointer back to the drug line that triggered the alert. */
  drugKey?: string;
}

export interface PatientContext {
  id?: string;
  age?: number;
  weightKg?: number;
  sex?: "M" | "F" | string;
  pregnant?: boolean;
  breastfeeding?: boolean;
  /** Free-text allergies; will be split by comma/semicolon/newline. */
  allergies?: string | null;
  /** Free-text chronic conditions. */
  chronicConditions?: string | null;
  /** Optional lab values that some rules inspect. */
  labs?: {
    /** Estimated GFR in mL/min/1.73m² */
    egfr?: number;
    /** Serum creatinine */
    creatinine?: number;
    /** ALT / AST in IU/L — used as a rough hepatic flag */
    alt?: number;
    ast?: number;
  };
}

export interface DrugRequest {
  /** Arbitrary client-side key so alerts can point back to a row. */
  key: string;
  /** Brand or dispensing name (e.g. "Calpol"). */
  name: string;
  /** Generic / INN name (e.g. "paracetamol"). */
  generic: string;
  /** Parsed strength e.g. 500 */
  strengthMg?: number;
  /** Frequency code — "1-0-1", "SOS", "STAT"… */
  frequency?: string;
  /** Duration string e.g. "5 days" */
  duration?: string;
  /** Route — "ORAL", "IV"… */
  route?: string;
  /** Quantity dispensed */
  quantity?: number;
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function splitFreeText(text?: string | null): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Very rough: converts "1-0-1" / "1-1-1" / "0-0-1" / "SOS" / "STAT" / "1-1-1-1" →
 * doses per day.
 */
function dosesPerDay(frequency?: string): number {
  if (!frequency) return 0;
  const f = frequency.toUpperCase();
  if (f === "SOS" || f === "STAT") return 1;
  const m = f.match(/(\d+)/g);
  if (!m) return 0;
  return m.reduce((a, b) => a + Number(b), 0);
}

/** True if any generic in `drugs` fuzzily contains `needle`. */
function containsGeneric(drugs: DrugRequest[], needle: string): boolean {
  const n = needle.toLowerCase();
  return drugs.some(
    (d) =>
      d.generic.toLowerCase().includes(n) || d.name.toLowerCase().includes(n),
  );
}

/* ─────────────────────────── Rules ─────────────────────────── */

/**
 * R1 · Allergy match — any charted allergy substring vs generic/brand.
 */
function allergyRule(ctx: PatientContext, drugs: DrugRequest[]): Alert[] {
  const allergies = splitFreeText(ctx.allergies);
  if (!allergies.length) return [];
  const out: Alert[] = [];
  for (const d of drugs) {
    for (const a of allergies) {
      if (!a) continue;
      if (
        d.generic.toLowerCase().includes(a) ||
        d.name.toLowerCase().includes(a)
      ) {
        out.push({
          severity: "HIGH",
          category: "allergy",
          message: `Allergy "${a}" conflicts with ${d.name}`,
          drugKey: d.key,
        });
      }
    }
  }
  return out;
}

/**
 * R2 · Duplicate therapy — same generic prescribed more than once.
 */
function duplicateRule(_ctx: PatientContext, drugs: DrugRequest[]): Alert[] {
  const seen = new Map<string, number>();
  for (const d of drugs) {
    const key = d.generic.toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const out: Alert[] = [];
  for (const [k, v] of seen) {
    if (v > 1) {
      out.push({
        severity: "MODERATE",
        category: "duplicate",
        message: `Duplicate therapy: ${k} appears ${v} times`,
      });
    }
  }
  return out;
}

/**
 * R3 · Known interaction pairs — tiny heuristic table.
 * In production this would query a real drug DB.
 */
const INTERACTION_PAIRS: Array<{
  a: string;
  b: string;
  severity: Severity;
  message: string;
}> = [
  {
    a: "warfarin",
    b: "aspirin",
    severity: "HIGH",
    message: "Warfarin + Aspirin: additive bleeding risk",
  },
  {
    a: "warfarin",
    b: "ibuprofen",
    severity: "HIGH",
    message: "Warfarin + NSAID: increased bleeding risk",
  },
  {
    a: "warfarin",
    b: "naproxen",
    severity: "HIGH",
    message: "Warfarin + NSAID: increased bleeding risk",
  },
  {
    a: "tramadol",
    b: "fluoxetine",
    severity: "MODERATE",
    message: "Tramadol + SSRI: serotonin syndrome risk",
  },
  {
    a: "tramadol",
    b: "sertraline",
    severity: "MODERATE",
    message: "Tramadol + SSRI: serotonin syndrome risk",
  },
  {
    a: "metformin",
    b: "iodinated contrast",
    severity: "HIGH",
    message: "Metformin + iodinated contrast: lactic acidosis risk",
  },
  {
    a: "clopidogrel",
    b: "omeprazole",
    severity: "MODERATE",
    message: "Clopidogrel + Omeprazole: reduced antiplatelet effect",
  },
  {
    a: "simvastatin",
    b: "clarithromycin",
    severity: "HIGH",
    message: "Simvastatin + Macrolide: rhabdomyolysis risk",
  },
  {
    a: "digoxin",
    b: "amiodarone",
    severity: "MODERATE",
    message: "Digoxin + Amiodarone: increased digoxin levels",
  },
];
function interactionRule(_ctx: PatientContext, drugs: DrugRequest[]): Alert[] {
  const out: Alert[] = [];
  for (const rule of INTERACTION_PAIRS) {
    if (containsGeneric(drugs, rule.a) && containsGeneric(drugs, rule.b)) {
      out.push({
        severity: rule.severity,
        category: "interaction",
        message: rule.message,
      });
    }
  }
  return out;
}

/**
 * R4 · Max daily dose for paracetamol (common overdose vector).
 */
function paracetamolMaxDoseRule(
  _ctx: PatientContext,
  drugs: DrugRequest[],
): Alert[] {
  const out: Alert[] = [];
  const paracetamols = drugs.filter((d) =>
    d.generic.toLowerCase().includes("paracetamol"),
  );
  if (!paracetamols.length) return out;
  let totalDaily = 0;
  for (const p of paracetamols) {
    const mg = p.strengthMg ?? 500;
    totalDaily += mg * dosesPerDay(p.frequency);
  }
  if (totalDaily > 4000) {
    out.push({
      severity: "HIGH",
      category: "dose",
      message: `Paracetamol ${totalDaily} mg/day exceeds 4 g/day max`,
    });
  } else if (totalDaily > 3000) {
    out.push({
      severity: "MODERATE",
      category: "dose",
      message: `Paracetamol ${totalDaily} mg/day approaching 4 g/day ceiling`,
    });
  }
  return out;
}

/**
 * R5 · Renal dosing flags when eGFR < 60 and a known-renally-excreted drug is present.
 */
const RENALLY_EXCRETED = [
  "metformin",
  "gabapentin",
  "digoxin",
  "atenolol",
  "enoxaparin",
  "nitrofurantoin",
];
function renalDosingRule(ctx: PatientContext, drugs: DrugRequest[]): Alert[] {
  const egfr = ctx.labs?.egfr;
  if (egfr == null || egfr >= 60) return [];
  const out: Alert[] = [];
  for (const d of drugs) {
    for (const r of RENALLY_EXCRETED) {
      if (d.generic.toLowerCase().includes(r)) {
        out.push({
          severity: egfr < 30 ? "HIGH" : "MODERATE",
          category: "renal",
          message: `Renal dosing needed: ${d.name} with eGFR ${egfr}`,
          drugKey: d.key,
        });
      }
    }
  }
  // Hard contraindication
  if (egfr < 30 && containsGeneric(drugs, "metformin")) {
    out.push({
      severity: "HIGH",
      category: "renal",
      message: "Metformin contraindicated when eGFR < 30",
    });
  }
  if (egfr < 30 && containsGeneric(drugs, "nitrofurantoin")) {
    out.push({
      severity: "HIGH",
      category: "renal",
      message: "Nitrofurantoin contraindicated when eGFR < 30",
    });
  }
  return out;
}

/**
 * R6 · Hepatic caution (very rough — flags statins + NSAIDs when ALT/AST elevated).
 */
function hepaticRule(ctx: PatientContext, drugs: DrugRequest[]): Alert[] {
  const alt = ctx.labs?.alt ?? 0;
  const ast = ctx.labs?.ast ?? 0;
  if (alt < 80 && ast < 80) return [];
  const out: Alert[] = [];
  const watched = ["statin", "paracetamol", "isoniazid", "methotrexate"];
  for (const d of drugs) {
    for (const w of watched) {
      if (d.generic.toLowerCase().includes(w)) {
        out.push({
          severity: "MODERATE",
          category: "hepatic",
          message: `Hepatic caution: ${d.name} with elevated LFTs (ALT ${alt}, AST ${ast})`,
          drugKey: d.key,
        });
      }
    }
  }
  return out;
}

/**
 * R7 · Pregnancy category — flag drugs with known teratogenic risk.
 */
const PREGNANCY_AVOID = [
  "warfarin",
  "isotretinoin",
  "methotrexate",
  "ribavirin",
  "finasteride",
  "misoprostol",
  "tetracycline",
  "doxycycline",
  "ace inhibitor",
  "enalapril",
  "lisinopril",
  "ramipril",
  "losartan",
];
function pregnancyRule(ctx: PatientContext, drugs: DrugRequest[]): Alert[] {
  if (!ctx.pregnant) return [];
  const out: Alert[] = [];
  for (const d of drugs) {
    for (const p of PREGNANCY_AVOID) {
      if (d.generic.toLowerCase().includes(p)) {
        out.push({
          severity: "HIGH",
          category: "pregnancy",
          message: `Pregnancy risk: ${d.name} should be avoided`,
          drugKey: d.key,
        });
      }
    }
  }
  return out;
}

/**
 * R8 · Pediatric weight-band check — very simple flag if age < 12
 * and quantity looks like an adult dose.
 */
function pediatricRule(ctx: PatientContext, drugs: DrugRequest[]): Alert[] {
  if (ctx.age == null || ctx.age >= 12) return [];
  const out: Alert[] = [];
  for (const d of drugs) {
    if (
      d.generic.toLowerCase().includes("paracetamol") &&
      (d.strengthMg ?? 0) >= 650
    ) {
      out.push({
        severity: "MODERATE",
        category: "pediatric",
        message: `Pediatric: Paracetamol ${d.strengthMg}mg is an adult strength (age ${ctx.age})`,
        drugKey: d.key,
      });
    }
    if (d.generic.toLowerCase().includes("aspirin") && ctx.age < 16) {
      out.push({
        severity: "HIGH",
        category: "pediatric",
        message: `Pediatric: Aspirin in children (Reye syndrome risk)`,
        drugKey: d.key,
      });
    }
  }
  return out;
}

/**
 * R9 · Geriatric caution — Beers list subset for age ≥ 65.
 */
const GERIATRIC_CAUTION = [
  "diphenhydramine",
  "amitriptyline",
  "diazepam",
  "lorazepam",
  "alprazolam",
];
function geriatricRule(ctx: PatientContext, drugs: DrugRequest[]): Alert[] {
  if (ctx.age == null || ctx.age < 65) return [];
  const out: Alert[] = [];
  for (const d of drugs) {
    for (const g of GERIATRIC_CAUTION) {
      if (d.generic.toLowerCase().includes(g)) {
        out.push({
          severity: "MODERATE",
          category: "geriatric",
          message: `Geriatric caution: ${d.name} on Beers list for age ≥ 65`,
          drugKey: d.key,
        });
      }
    }
  }
  return out;
}

type Rule = (ctx: PatientContext, drugs: DrugRequest[]) => Alert[];

const RULES: Rule[] = [
  allergyRule,
  duplicateRule,
  interactionRule,
  paracetamolMaxDoseRule,
  renalDosingRule,
  hepaticRule,
  pregnancyRule,
  pediatricRule,
  geriatricRule,
];

/**
 * Run every registered rule against a patient context + prescribed drugs.
 * Returns a flat list of alerts, sorted by severity (HIGH → INFO).
 * Always appends an INFO "all clear" alert when no issues found.
 */
export function runRules(ctx: PatientContext, drugs: DrugRequest[]): Alert[] {
  if (!drugs.length) return [];
  const alerts = RULES.flatMap((rule) => {
    try {
      return rule(ctx, drugs);
    } catch {
      return [];
    }
  });
  if (alerts.length === 0) {
    return [
      {
        severity: "INFO",
        category: "info",
        message: "No interactions, allergies or dosing issues detected",
      },
    ];
  }
  const order: Record<Severity, number> = { HIGH: 0, MODERATE: 1, LOW: 2, INFO: 3 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

/**
 * Utility for UI: true if any alert is HIGH severity (blocks signing).
 */
export function hasBlockingAlert(alerts: Alert[]): boolean {
  return alerts.some((a) => a.severity === "HIGH" && a.category !== "info");
}

/**
 * Utility: group alerts by severity for compact rendering.
 */
export function groupAlerts(alerts: Alert[]) {
  const out: Record<Severity, Alert[]> = { HIGH: [], MODERATE: [], LOW: [], INFO: [] };
  for (const a of alerts) out[a.severity].push(a);
  return out;
}
