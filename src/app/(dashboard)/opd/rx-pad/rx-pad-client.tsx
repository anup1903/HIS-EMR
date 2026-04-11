"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSignature,
  Mic,
  MicOff,
  Pill,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PatientContextBar } from "@/components/shared/patient-context-bar";
import {
  runRules,
  hasBlockingAlert,
  type Alert as CdsAlert,
  type DrugRequest,
} from "@/lib/cds/rules";

/* ─────────────────────────── Types ─────────────────────────── */
interface Drug {
  id: string;
  name: string;
  genericName: string;
  brandName?: string | null;
  strength: string;
  dosageForm: string;
  stockQuantity: number;
  sellingPrice: number | string;
  requiresPrescription: boolean;
}

interface RxLine {
  key: string; // client-side key
  drugId: string;
  drugLabel: string; // cached display "Paracetamol 500mg Tab"
  genericName: string;
  frequency: string; // "1-0-1" | "0-0-1" | "SOS" | "STAT" | custom
  timing: string; // "After food" | "Before food" | "Bedtime" | ""
  duration: string; // "5 days"
  route: string; // "ORAL"
  quantity: number;
  instructions: string;
  price: number;
}

interface PatientHeader {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
}

/* ─────────────────────────── Constants ─────────────────────────── */
const FREQUENCY_CHIPS = [
  { label: "1-0-0", value: "1-0-0", doses: 1 },
  { label: "0-1-0", value: "0-1-0", doses: 1 },
  { label: "0-0-1", value: "0-0-1", doses: 1 },
  { label: "1-0-1", value: "1-0-1", doses: 2 },
  { label: "1-1-1", value: "1-1-1", doses: 3 },
  { label: "1-1-1-1", value: "1-1-1-1", doses: 4 },
  { label: "SOS", value: "SOS", doses: 1 },
  { label: "STAT", value: "STAT", doses: 1 },
];
const TIMING_CHIPS = ["After food", "Before food", "Bedtime", "Empty stomach"];
const DURATION_CHIPS = ["3 days", "5 days", "7 days", "10 days", "15 days", "1 month"];
const ROUTE_CHIPS = ["ORAL", "IV", "IM", "SC", "TOP", "INH", "SUB", "PR"];

/* ─────────────────────────── CDS adapter ─────────────────────────── */
/**
 * Thin adapter from the Rx pad's line model to the isomorphic
 * CDS rules engine defined in `src/lib/cds/rules.ts`.
 */
function parseStrengthMg(label: string): number | undefined {
  const m = label.match(/(\d+(?:\.\d+)?)\s*mg/i);
  return m ? parseFloat(m[1]) : undefined;
}

function runSafetyChecks(lines: RxLine[], patient: PatientHeader | null): CdsAlert[] {
  if (!lines.length || !patient) return [];
  const ageYears = patient.dateOfBirth
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(patient.dateOfBirth).getTime()) /
            (1000 * 60 * 60 * 24 * 365.25),
        ),
      )
    : undefined;
  const drugs: DrugRequest[] = lines.map((l) => ({
    key: l.key,
    name: l.drugLabel,
    generic: l.genericName,
    strengthMg: parseStrengthMg(l.drugLabel),
    frequency: l.frequency,
    duration: l.duration,
    route: l.route,
    quantity: l.quantity,
  }));
  return runRules(
    {
      id: patient.id,
      age: ageYears,
      sex: patient.gender,
      allergies: patient.allergies,
      chronicConditions: patient.chronicConditions,
    },
    drugs,
  );
}

/* ─────────────────────────── Component ─────────────────────────── */
export function RxPad() {
  const router = useRouter();
  const params = useSearchParams();
  const patientId = params.get("patientId") ?? "";
  const consultationId = params.get("consultationId") ?? "";

  const [patient, setPatient] = useState<PatientHeader | null>(null);
  const [patientLoading, setPatientLoading] = useState(false);

  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<RxLine[]>([]);

  const [search, setSearch] = useState("");
  const [drugResults, setDrugResults] = useState<Drug[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const [signing, setSigning] = useState(false);
  const [saving, setSaving] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  /* Fetch patient header */
  useEffect(() => {
    if (!patientId) return;
    setPatientLoading(true);
    fetch(`/api/patients/${patientId}`)
      .then((r) => r.json())
      .then((j) => setPatient(j.data ?? null))
      .finally(() => setPatientLoading(false));
  }, [patientId]);

  /* Load a few patients for selection if none provided */
  const [patientPickList, setPatientPickList] = useState<PatientHeader[]>([]);
  useEffect(() => {
    if (patientId) return;
    fetch("/api/patients?limit=15")
      .then((r) => r.json())
      .then((j) => setPatientPickList(j.data ?? []));
  }, [patientId]);

  /* Drug search debounce */
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setDrugResults([]);
      setShowResults(false);
      return;
    }
    const h = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await fetch(`/api/pharmacy/drugs?search=${encodeURIComponent(q)}&limit=8`);
        const json = await res.json();
        setDrugResults(Array.isArray(json.data) ? json.data : []);
        setHighlightIdx(0);
        setShowResults(true);
      } finally {
        setSearching(false);
      }
    }, 140);
    return () => clearTimeout(h);
  }, [search]);

  /* Keyboard shortcuts: / focuses search, Ctrl+S saves draft */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      const inEditable =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if (e.key === "/" && !inEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleSave("draft");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, diagnosis, notes]);

  /* ───── Add line ───── */
  const addDrug = useCallback((drug: Drug) => {
    setLines((prev) => [
      ...prev,
      {
        key: `${drug.id}-${Date.now()}`,
        drugId: drug.id,
        drugLabel: `${drug.name} ${drug.strength} ${drug.dosageForm}`.trim(),
        genericName: drug.genericName,
        frequency: "1-0-1",
        timing: "After food",
        duration: "5 days",
        route: "ORAL",
        quantity: 10,
        instructions: "",
        price: Number(drug.sellingPrice ?? 0),
      },
    ]);
    setSearch("");
    setDrugResults([]);
    setShowResults(false);
    // Refocus search for rapid entry
    setTimeout(() => searchRef.current?.focus(), 20);
  }, []);

  const removeLine = (key: string) =>
    setLines((prev) => prev.filter((l) => l.key !== key));

  const updateLine = (key: string, patch: Partial<RxLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  /* Combobox keyboard navigation */
  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || drugResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, drugResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = drugResults[highlightIdx];
      if (pick) addDrug(pick);
    } else if (e.key === "Escape") {
      setShowResults(false);
    }
  };

  /* Templates — per-diagnosis quickpicks (stub) */
  const templates = useMemo(
    () => [
      {
        name: "Viral URI",
        dx: "Acute upper respiratory tract infection",
        hint: "Paracetamol + Cetirizine + Rest",
      },
      {
        name: "Acute gastritis",
        dx: "Acute gastritis",
        hint: "Pantoprazole + Antacid + Dietary advice",
      },
      {
        name: "Uncomplicated UTI",
        dx: "Urinary tract infection",
        hint: "Nitrofurantoin + Pyridium + Fluids",
      },
    ],
    [],
  );

  const applyTemplate = (tpl: (typeof templates)[number]) => {
    setDiagnosis(tpl.dx);
    toast.info(`Template applied: ${tpl.name}`, { description: tpl.hint });
  };

  /* ─── AI-assisted Rx suggestion ─── */
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [aiRedFlags, setAiRedFlags] = useState<string[]>([]);
  const [aiFollowUp, setAiFollowUp] = useState<string | null>(null);

  const aiSuggest = async () => {
    if (!diagnosis.trim()) {
      toast.error("Enter a diagnosis first.");
      return;
    }
    if (!patient) {
      toast.error("Select a patient first.");
      return;
    }
    setAiLoading(true);
    try {
      const age = patient.dateOfBirth
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - new Date(patient.dateOfBirth).getTime()) /
                (1000 * 60 * 60 * 24 * 365.25),
            ),
          )
        : undefined;
      const res = await fetch("/api/ai/rx-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diagnosis,
          patient: {
            age,
            sex: patient.gender,
            allergies: patient.allergies,
            chronicConditions: patient.chronicConditions,
          },
          currentMedications: lines.map((l) => l.genericName),
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "AI suggestion failed", {
          description:
            json.code === "AI_DISABLED"
              ? "Set ANTHROPIC_API_KEY to enable."
              : undefined,
        });
        return;
      }
      const sug = json.data as {
        reasoning: string;
        redFlags: string[];
        followUp: string;
        suggestions: Array<{
          generic: string;
          brandExample: string;
          strength: string;
          dosageForm: string;
          frequency: string;
          timing: string;
          duration: string;
          route: string;
          rationale: string;
        }>;
      };
      setAiReasoning(sug.reasoning);
      setAiRedFlags(sug.redFlags ?? []);
      setAiFollowUp(sug.followUp);
      if (!sug.suggestions?.length) {
        toast.info("AI declined to suggest — review reasoning panel.");
        return;
      }
      // Try to map each suggestion to a stocked drug; fall back to a virtual line.
      const newLines: RxLine[] = [];
      for (const s of sug.suggestions) {
        let match: Drug | null = null;
        try {
          const r = await fetch(
            `/api/pharmacy/drugs?search=${encodeURIComponent(s.generic)}&limit=1`,
          );
          const j = await r.json();
          if (Array.isArray(j.data) && j.data.length > 0) match = j.data[0];
        } catch {
          /* ignore */
        }
        newLines.push({
          key: `ai-${s.generic}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          drugId: match?.id ?? "",
          drugLabel: match
            ? `${match.name} ${match.strength} ${match.dosageForm}`.trim()
            : `${s.brandExample || s.generic} ${s.strength} ${s.dosageForm}`.trim(),
          genericName: match?.genericName ?? s.generic,
          frequency: s.frequency || "1-0-1",
          timing: s.timing || "After food",
          duration: s.duration || "5 days",
          route: s.route || "ORAL",
          quantity: 10,
          instructions: s.rationale || "",
          price: Number(match?.sellingPrice ?? 0),
        });
      }
      setLines((prev) => [...prev, ...newLines]);
      toast.success(
        `AI added ${newLines.length} suggestion${newLines.length === 1 ? "" : "s"}`,
        { description: "Review, edit, and sign." },
      );
    } catch (err) {
      toast.error("AI request failed");
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  /* Voice dictation (Web Speech API, best-effort) */
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<unknown>(null);
  const startDictation = () => {
    type Ctor = new () => {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      onresult: (e: { results: Array<Array<{ transcript: string }>> }) => void;
      onend: () => void;
      onerror: (e: { error: string }) => void;
      start(): void;
      stop(): void;
    };
    const w = window as unknown as {
      SpeechRecognition?: Ctor;
      webkitSpeechRecognition?: Ctor;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice dictation not supported in this browser.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      if (text) setNotes((n) => (n ? n + " " : "") + text);
    };
    rec.onerror = (e) => {
      toast.error(`Dictation error: ${e.error}`);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };
  const stopDictation = () => {
    const rec = recognitionRef.current as { stop(): void } | null;
    rec?.stop();
    setListening(false);
  };

  /* Totals + safety */
  const alerts = useMemo(() => runSafetyChecks(lines, patient), [lines, patient]);
  const total = useMemo(
    () => lines.reduce((s, l) => s + l.price * l.quantity, 0),
    [lines],
  );
  const hasBlocker = hasBlockingAlert(alerts);

  /* ───── Save (draft = PENDING; sign = PENDING too but toast differently) ───── */
  async function handleSave(mode: "draft" | "sign") {
    if (!patient) {
      toast.error("Select a patient first.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one medication.");
      return;
    }
    if (mode === "sign" && hasBlocker) {
      toast.error("Resolve HIGH severity alerts before signing.");
      return;
    }
    const payload = {
      patientId: patient.id,
      consultationId: consultationId || undefined,
      notes: [diagnosis && `Dx: ${diagnosis}`, notes].filter(Boolean).join("\n") || undefined,
      items: lines.map((l) => ({
        drugId: l.drugId,
        dosage: l.frequency,
        frequency: l.timing ? `${l.frequency} · ${l.timing}` : l.frequency,
        duration: l.duration,
        route: l.route,
        instructions: l.instructions || undefined,
        quantity: l.quantity,
      })),
    };
    try {
      mode === "sign" ? setSigning(true) : setSaving(true);
      const res = await fetch("/api/pharmacy/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to save prescription");
        return;
      }
      toast.success(
        mode === "sign" ? "Rx signed and sent to pharmacy" : "Rx saved as draft",
        { description: json.data?.prescriptionNo },
      );
      if (mode === "sign") {
        // Pop the printable letterhead in a new tab; pharmacy gets it via the queue.
        if (json.data?.id) {
          window.open(`/print/prescriptions/${json.data.id}`, "_blank");
        }
        router.push(`/pharmacy`);
      }
    } finally {
      setSigning(false);
      setSaving(false);
    }
  }

  const age = patient
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(patient.dateOfBirth).getTime()) /
            (1000 * 60 * 60 * 24 * 365.25),
        ),
      )
    : null;

  /* ─────────────────────────── Render ─────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Sticky context bar */}
      <div className="sticky top-16 z-20">
        {patientLoading ? (
          <Skeleton className="h-14 w-full" />
        ) : patient ? (
          <PatientContextBar patient={patient} live flush>
            <Button
              variant="secondary"
              size="sm"
              className="bg-white/15 text-white border-white/25 hover:bg-white/25"
              onClick={() => handleSave("draft")}
              disabled={saving || lines.length === 0}
            >
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? "Saving…" : "Save draft"}
            </Button>
            <Button
              size="sm"
              className="bg-teal-400 text-slate-900 hover:bg-teal-300"
              onClick={() => handleSave("sign")}
              disabled={signing || lines.length === 0 || hasBlocker}
            >
              <FileSignature className="mr-1.5 h-4 w-4" />
              {signing ? "Signing…" : "Sign & send"}
            </Button>
          </PatientContextBar>
        ) : (
          <div className="-mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-background/95 backdrop-blur border-b">
            <PatientPicker
              patients={patientPickList}
              onPick={(p) => router.push(`/opd/rx-pad?patientId=${p.id}`)}
            />
          </div>
        )}
      </div>

      {/* Main layout */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: Rx composition */}
        <div className="lg:col-span-2 space-y-4">
          {/* Diagnosis + templates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                Diagnosis & template
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 text-xs"
                  onClick={aiSuggest}
                  disabled={aiLoading || !diagnosis.trim() || !patient}
                  title="AI suggestion (Claude)"
                >
                  <Sparkles className="h-3 w-3" />
                  {aiLoading ? "Thinking…" : "AI suggest"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Type diagnosis (ICD-10 coming soon)…"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => applyTemplate(t)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {t.name}
                  </button>
                ))}
              </div>
              {(aiReasoning || aiRedFlags.length > 0 || aiFollowUp) && (
                <div className="rounded-md border bg-accent/40 p-2.5 space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1 text-accent-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <Sparkles className="h-3 w-3" />
                    AI reasoning
                  </div>
                  {aiReasoning && (
                    <p className="leading-snug text-foreground/90">{aiReasoning}</p>
                  )}
                  {aiRedFlags.length > 0 && (
                    <div className="space-y-0.5">
                      <div className="font-semibold text-destructive">Red flags</div>
                      <ul className="list-disc list-inside text-destructive/90">
                        {aiRedFlags.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiFollowUp && (
                    <p className="italic text-muted-foreground">
                      Follow-up: {aiFollowUp}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Drug search combobox */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Pill className="h-4 w-4 text-primary" />
                Add medication
                <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                  Press <kbd>/</kbd> to focus, <kbd>↑↓</kbd> to navigate, <kbd>↵</kbd> to add
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={onSearchKeyDown}
                  onFocus={() => drugResults.length > 0 && setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 120)}
                  placeholder="Search drug by name or generic…"
                  className="pl-9"
                />
                {showResults && (searching || drugResults.length > 0) && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-lg">
                    {searching && (
                      <div className="p-3 text-xs text-muted-foreground">Searching…</div>
                    )}
                    {!searching &&
                      drugResults.map((d, idx) => {
                        const inStock = d.stockQuantity > 10;
                        const low = d.stockQuantity > 0 && d.stockQuantity <= 10;
                        return (
                          <button
                            key={d.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              addDrug(d);
                            }}
                            onMouseEnter={() => setHighlightIdx(idx)}
                            className={cn(
                              "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                              idx === highlightIdx
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-muted",
                            )}
                          >
                            <Pill className="h-4 w-4 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="truncate font-medium">
                                {d.name}{" "}
                                <span className="font-normal text-muted-foreground">
                                  {d.strength} · {d.dosageForm}
                                </span>
                              </div>
                              <div className="truncate text-[11px] text-muted-foreground">
                                {d.genericName}
                                {d.brandName ? ` · ${d.brandName}` : ""}
                              </div>
                            </div>
                            <div className="shrink-0 text-right tabular-nums">
                              <div className="text-xs font-semibold">
                                ₹{Number(d.sellingPrice).toFixed(2)}
                              </div>
                              <div
                                className={cn(
                                  "text-[10px]",
                                  inStock && "text-success",
                                  low && "text-warning",
                                  !inStock && !low && "text-destructive",
                                )}
                              >
                                {inStock
                                  ? `✓ In stock (${d.stockQuantity})`
                                  : low
                                    ? `⚠ Low (${d.stockQuantity})`
                                    : "✗ Out of stock"}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Line items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Plus className="h-4 w-4 text-primary" />
                Prescription ({lines.length})
                {lines.length > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    Est. total: ₹{total.toFixed(2)}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lines.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No medications yet. Start typing above to add drugs.
                </div>
              ) : (
                lines.map((l, idx) => (
                  <div
                    key={l.key}
                    className="rounded-lg border bg-card p-3 space-y-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold tabular-nums">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {l.drugLabel}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {l.genericName}
                        </div>
                      </div>
                      <button
                        onClick={() => removeLine(l.key)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid gap-2 md:grid-cols-12">
                      {/* Frequency */}
                      <div className="md:col-span-5">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          Frequency
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {FREQUENCY_CHIPS.map((f) => (
                            <Chip
                              key={f.value}
                              active={l.frequency === f.value}
                              onClick={() => updateLine(l.key, { frequency: f.value })}
                            >
                              {f.label}
                            </Chip>
                          ))}
                        </div>
                      </div>

                      {/* Duration */}
                      <div className="md:col-span-4">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          Duration
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {DURATION_CHIPS.map((d) => (
                            <Chip
                              key={d}
                              active={l.duration === d}
                              onClick={() => updateLine(l.key, { duration: d })}
                            >
                              {d}
                            </Chip>
                          ))}
                        </div>
                      </div>

                      {/* Qty */}
                      <div className="md:col-span-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          Qty
                        </div>
                        <Input
                          type="number"
                          min={1}
                          value={l.quantity}
                          onChange={(e) =>
                            updateLine(l.key, {
                              quantity: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-12">
                      {/* Timing */}
                      <div className="md:col-span-6">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          Timing
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {TIMING_CHIPS.map((t) => (
                            <Chip
                              key={t}
                              active={l.timing === t}
                              onClick={() => updateLine(l.key, { timing: t })}
                            >
                              {t}
                            </Chip>
                          ))}
                        </div>
                      </div>
                      {/* Route */}
                      <div className="md:col-span-6">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          Route
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {ROUTE_CHIPS.map((r) => (
                            <Chip
                              key={r}
                              active={l.route === r}
                              onClick={() => updateLine(l.key, { route: r })}
                            >
                              {r}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    </div>

                    <Input
                      placeholder="Instructions (e.g., take with plenty of water)"
                      value={l.instructions}
                      onChange={(e) =>
                        updateLine(l.key, { instructions: e.target.value })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Notes + dictation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                Advice / Notes
                <Button
                  type="button"
                  variant={listening ? "default" : "outline"}
                  size="sm"
                  className="ml-auto h-7"
                  onClick={listening ? stopDictation : startDictation}
                >
                  {listening ? (
                    <>
                      <MicOff className="mr-1.5 h-3.5 w-3.5" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic className="mr-1.5 h-3.5 w-3.5" />
                      Dictate
                    </>
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={3}
                placeholder="Advice, follow-up, lifestyle, precautions…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right: Safety panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Safety checks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.map((a, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-md border p-2.5 text-xs leading-snug",
                    a.severity === "HIGH" &&
                      "border-destructive/40 bg-destructive/5 text-destructive",
                    a.severity === "MODERATE" &&
                      "border-warning/40 bg-warning/5 text-warning",
                    a.severity === "LOW" && "border-info/40 bg-info/5 text-info",
                    a.severity === "INFO" &&
                      "border-success/40 bg-success/5 text-success",
                  )}
                >
                  <div className="flex items-start gap-1.5">
                    {a.severity === "INFO" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span>{a.message}</span>
                      <span className="ml-1 rounded bg-background/60 px-1 py-0.5 text-[9px] uppercase tracking-wider">
                        {a.category}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Medications" value={String(lines.length)} />
              <Row
                label="Est. total"
                value={`₹${total.toFixed(2)}`}
                accent="primary"
              />
              <Row
                label="High alerts"
                value={String(alerts.filter((a) => a.severity === "HIGH").length)}
                accent={hasBlocker ? "destructive" : undefined}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button onClick={() => handleSave("sign")} disabled={signing || lines.length === 0 || hasBlocker}>
              <FileSignature className="mr-2 h-4 w-4" />
              Sign & send to pharmacy
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSave("draft")}
              disabled={saving || lines.length === 0}
            >
              <Save className="mr-2 h-4 w-4" />
              Save draft
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setLines([]);
                setDiagnosis("");
                setNotes("");
                toast.info("Pad cleared");
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Subcomponents ─────────────────────────── */
function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "primary" | "destructive";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums font-semibold",
          accent === "primary" && "text-primary",
          accent === "destructive" && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function PatientPicker({
  patients,
  onPick,
}: {
  patients: PatientHeader[];
  onPick: (p: PatientHeader) => void;
}) {
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="text-sm text-muted-foreground">
        Pick a patient to start:
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-none">
        {patients.slice(0, 10).map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p)}
            className="shrink-0 rounded-md border bg-card px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
          >
            {p.firstName} {p.lastName}{" "}
            <span className="text-muted-foreground">· {p.mrn}</span>
          </button>
        ))}
      </div>
      <div className="ml-auto text-xs text-muted-foreground">
        Or press <kbd>⌘K</kbd> to find a patient
      </div>
    </div>
  );
}
