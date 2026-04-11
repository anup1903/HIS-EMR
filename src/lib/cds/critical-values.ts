/**
 * Critical-Value Alert Engine
 * ---------------------------
 * Given a lab panel (test code + numeric value + unit), return any
 * critical-value alerts that need an immediate read-back to the
 * ordering provider per standard lab-safety protocols.
 *
 * These thresholds are conservative and illustrative — a production
 * deployment should replace them with site-specific values governed
 * by your lab director.
 */

export type LabSeverity = "CRITICAL" | "HIGH" | "LOW" | "INFO";

export interface LabResultInput {
  /** Canonical test code (lowercase), e.g. "potassium", "glucose", "hb", "wbc". */
  code: string;
  /** Numeric result value. */
  value: number;
  /** Result unit (used only for display). */
  unit?: string;
  /** Optional patient context for age/sex-aware thresholds. */
  ageYears?: number;
  sex?: "M" | "F" | string;
}

export interface LabAlert {
  severity: LabSeverity;
  code: string;
  message: string;
  flag?: "H" | "L" | "HH" | "LL";
  recommend?: string;
}

type Threshold = {
  code: string;
  criticalLow?: number;
  low?: number;
  high?: number;
  criticalHigh?: number;
  unit: string;
  label: string;
  recommend?: string;
};

/**
 * Conservative adult thresholds for common analytes (SI / conventional mix).
 * Override / extend per your lab's policy.
 */
const THRESHOLDS: Threshold[] = [
  {
    code: "hb",
    label: "Hemoglobin",
    unit: "g/dL",
    criticalLow: 7,
    low: 12,
    high: 18,
    criticalHigh: 20,
    recommend: "Consider transfusion protocol if <7",
  },
  {
    code: "wbc",
    label: "WBC",
    unit: "×10³/µL",
    criticalLow: 2,
    low: 4,
    high: 11,
    criticalHigh: 30,
    recommend: "Neutropenic / leukemoid — isolate and escalate",
  },
  {
    code: "platelets",
    label: "Platelets",
    unit: "×10³/µL",
    criticalLow: 20,
    low: 150,
    high: 450,
    criticalHigh: 1000,
    recommend: "Bleeding risk below 20; consider platelet transfusion",
  },
  {
    code: "potassium",
    label: "Potassium (K⁺)",
    unit: "mmol/L",
    criticalLow: 2.8,
    low: 3.5,
    high: 5.1,
    criticalHigh: 6,
    recommend: "ECG + IV correction for K <3.0 or >6.0",
  },
  {
    code: "sodium",
    label: "Sodium (Na⁺)",
    unit: "mmol/L",
    criticalLow: 120,
    low: 135,
    high: 145,
    criticalHigh: 160,
  },
  {
    code: "glucose",
    label: "Glucose",
    unit: "mg/dL",
    criticalLow: 40,
    low: 70,
    high: 180,
    criticalHigh: 500,
    recommend: "Hypo: give dextrose; hyper: start insulin protocol",
  },
  {
    code: "creatinine",
    label: "Creatinine",
    unit: "mg/dL",
    high: 1.3,
    criticalHigh: 4.0,
    recommend: "Review renal dosing; hold nephrotoxics",
  },
  {
    code: "inr",
    label: "INR",
    unit: "",
    high: 3.5,
    criticalHigh: 5,
    recommend: "Hold warfarin; consider vitamin K / PCC if bleeding",
  },
  {
    code: "calcium",
    label: "Calcium",
    unit: "mg/dL",
    criticalLow: 6,
    low: 8.5,
    high: 10.5,
    criticalHigh: 13,
  },
  {
    code: "ph",
    label: "Arterial pH",
    unit: "",
    criticalLow: 7.2,
    low: 7.35,
    high: 7.45,
    criticalHigh: 7.55,
  },
  {
    code: "troponin",
    label: "Troponin I",
    unit: "ng/mL",
    high: 0.04,
    criticalHigh: 0.4,
    recommend: "Rule out MI; activate ACS pathway",
  },
  {
    code: "lactate",
    label: "Lactate",
    unit: "mmol/L",
    high: 2,
    criticalHigh: 4,
    recommend: "Sepsis — start sepsis bundle",
  },
];

/** Check a single result and return all applicable alerts. */
export function checkLabResult(input: LabResultInput): LabAlert[] {
  const code = input.code.toLowerCase().trim();
  const t = THRESHOLDS.find((x) => x.code === code);
  if (!t) return [];

  const v = input.value;
  const alerts: LabAlert[] = [];

  if (t.criticalLow != null && v <= t.criticalLow) {
    alerts.push({
      severity: "CRITICAL",
      code,
      flag: "LL",
      message: `${t.label} critically low: ${v} ${t.unit}`,
      recommend: t.recommend,
    });
  } else if (t.low != null && v < t.low) {
    alerts.push({
      severity: "LOW",
      code,
      flag: "L",
      message: `${t.label} low: ${v} ${t.unit}`,
    });
  } else if (t.criticalHigh != null && v >= t.criticalHigh) {
    alerts.push({
      severity: "CRITICAL",
      code,
      flag: "HH",
      message: `${t.label} critically high: ${v} ${t.unit}`,
      recommend: t.recommend,
    });
  } else if (t.high != null && v > t.high) {
    alerts.push({
      severity: "HIGH",
      code,
      flag: "H",
      message: `${t.label} high: ${v} ${t.unit}`,
    });
  }

  return alerts;
}

/** Check a whole panel (e.g., CBC results) and return all alerts. */
export function checkPanel(results: LabResultInput[]): LabAlert[] {
  return results.flatMap((r) => checkLabResult(r));
}

/** True if any alert is severity CRITICAL. */
export function hasCriticalAlert(alerts: LabAlert[]): boolean {
  return alerts.some((a) => a.severity === "CRITICAL");
}
