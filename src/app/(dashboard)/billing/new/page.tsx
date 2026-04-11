"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  Search,
  Trash2,
  Plus,
  Minus,
  User as UserIcon,
  Stethoscope,
  FlaskConical,
  ScanLine,
  Pill,
  BedDouble,
  Package,
  Percent,
  Save,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ─────────────────────────── Types ─────────────────────────── */
type Category =
  | "Consultation"
  | "Procedures"
  | "Labs"
  | "Imaging"
  | "Pharmacy"
  | "Room & Bed"
  | "Packages"
  | "Other";

interface CatalogItem {
  id: string;
  description: string;
  category: Category;
  unitPrice: number;
  /** Package children expand into these items when added. */
  children?: Omit<CatalogItem, "children">[];
}

interface CartLine {
  key: string;
  description: string;
  category: Category;
  quantity: number;
  unitPrice: number;
}

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

/* ─────────────────────────── Default catalog ─────────────────────────── */
const CATEGORIES: { name: Category; icon: React.ComponentType<{ className?: string }> }[] = [
  { name: "Consultation", icon: Stethoscope },
  { name: "Procedures", icon: Sparkles },
  { name: "Labs", icon: FlaskConical },
  { name: "Imaging", icon: ScanLine },
  { name: "Pharmacy", icon: Pill },
  { name: "Room & Bed", icon: BedDouble },
  { name: "Packages", icon: Package },
  { name: "Other", icon: Receipt },
];

const DEFAULT_CATALOG: CatalogItem[] = [
  { id: "c-gen", description: "General consultation", category: "Consultation", unitPrice: 500 },
  { id: "c-spec", description: "Specialist consultation", category: "Consultation", unitPrice: 1000 },
  { id: "c-fu", description: "Follow-up consultation", category: "Consultation", unitPrice: 250 },

  { id: "p-dressing", description: "Wound dressing", category: "Procedures", unitPrice: 300 },
  { id: "p-injection", description: "Injection administration", category: "Procedures", unitPrice: 150 },
  { id: "p-nebulization", description: "Nebulization", category: "Procedures", unitPrice: 200 },

  { id: "l-cbc", description: "CBC (Complete blood count)", category: "Labs", unitPrice: 350 },
  { id: "l-lft", description: "LFT (Liver function)", category: "Labs", unitPrice: 650 },
  { id: "l-kft", description: "KFT (Kidney function)", category: "Labs", unitPrice: 550 },
  { id: "l-lipid", description: "Lipid profile", category: "Labs", unitPrice: 500 },
  { id: "l-hba1c", description: "HbA1c", category: "Labs", unitPrice: 400 },
  { id: "l-tsh", description: "TSH", category: "Labs", unitPrice: 400 },

  { id: "i-xr-chest", description: "X-ray chest PA", category: "Imaging", unitPrice: 600 },
  { id: "i-usg-abd", description: "USG abdomen", category: "Imaging", unitPrice: 1200 },
  { id: "i-ct-brain", description: "CT brain plain", category: "Imaging", unitPrice: 2500 },
  { id: "i-mri-spine", description: "MRI lumbar spine", category: "Imaging", unitPrice: 6500 },

  { id: "r-general", description: "General ward bed (per day)", category: "Room & Bed", unitPrice: 1500 },
  { id: "r-semi", description: "Semi-private room (per day)", category: "Room & Bed", unitPrice: 3000 },
  { id: "r-private", description: "Private room (per day)", category: "Room & Bed", unitPrice: 5000 },
  { id: "r-icu", description: "ICU (per day)", category: "Room & Bed", unitPrice: 8000 },

  {
    id: "pkg-diabetes",
    description: "Diabetes check-up package",
    category: "Packages",
    unitPrice: 2500,
    children: [
      { id: "l-cbc-pkg1", description: "CBC", category: "Labs", unitPrice: 350 },
      { id: "l-hba1c-pkg1", description: "HbA1c", category: "Labs", unitPrice: 400 },
      { id: "l-lipid-pkg1", description: "Lipid profile", category: "Labs", unitPrice: 500 },
      { id: "c-gen-pkg1", description: "General consultation", category: "Consultation", unitPrice: 500 },
    ],
  },
  {
    id: "pkg-exec",
    description: "Executive health check-up",
    category: "Packages",
    unitPrice: 6500,
    children: [
      { id: "l-cbc-pkg2", description: "CBC", category: "Labs", unitPrice: 350 },
      { id: "l-lft-pkg2", description: "LFT", category: "Labs", unitPrice: 650 },
      { id: "l-kft-pkg2", description: "KFT", category: "Labs", unitPrice: 550 },
      { id: "l-lipid-pkg2", description: "Lipid profile", category: "Labs", unitPrice: 500 },
      { id: "l-tsh-pkg2", description: "TSH", category: "Labs", unitPrice: 400 },
      { id: "i-xr-chest-pkg2", description: "X-ray chest", category: "Imaging", unitPrice: 600 },
      { id: "i-usg-abd-pkg2", description: "USG abdomen", category: "Imaging", unitPrice: 1200 },
      { id: "c-spec-pkg2", description: "Specialist consultation", category: "Consultation", unitPrice: 1000 },
    ],
  },
];

/* ─────────────────────────── Page ─────────────────────────── */
export default function NewInvoicePage() {
  const router = useRouter();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientHits, setPatientHits] = useState<Patient[]>([]);
  const [showPatientHits, setShowPatientHits] = useState(false);

  const [activeCategory, setActiveCategory] = useState<Category>("Consultation");
  const [catalogQuery, setCatalogQuery] = useState("");

  const [cart, setCart] = useState<CartLine[]>([]);

  const [discountPct, setDiscountPct] = useState(0);
  const [taxPct, setTaxPct] = useState(0);
  const [selfShare, setSelfShare] = useState(100); // %
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  /* ── Patient search ── */
  useEffect(() => {
    const q = patientQuery.trim();
    if (q.length < 2) {
      setPatientHits([]);
      return;
    }
    const h = setTimeout(async () => {
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setPatientHits(Array.isArray(json.data) ? json.data.slice(0, 6) : []);
      setShowPatientHits(true);
    }, 160);
    return () => clearTimeout(h);
  }, [patientQuery]);

  /* ── Keyboard: "/" focuses catalog search ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const inEditable =
        t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable;
      if (e.key === "/" && !inEditable) {
        e.preventDefault();
        (document.getElementById("bill-catalog-search") as HTMLInputElement)?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  /* ── Catalog filter ── */
  const visibleCatalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    return DEFAULT_CATALOG.filter((i) => {
      const catOK = q ? true : i.category === activeCategory;
      const qOK = q ? i.description.toLowerCase().includes(q) : true;
      return catOK && qOK;
    });
  }, [activeCategory, catalogQuery]);

  /* ── Cart operations ── */
  const addItem = useCallback((item: CatalogItem) => {
    setCart((prev) => {
      // If package, expand children
      if (item.children && item.children.length) {
        const newLines: CartLine[] = item.children.map((c) => ({
          key: `${c.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          description: c.description,
          category: c.category,
          quantity: 1,
          unitPrice: c.unitPrice,
        }));
        toast.success(`Package added: ${item.description}`, {
          description: `${newLines.length} items`,
        });
        return [...prev, ...newLines];
      }
      // Merge by description+unitPrice
      const existing = prev.find(
        (l) => l.description === item.description && l.unitPrice === item.unitPrice,
      );
      if (existing) {
        return prev.map((l) =>
          l === existing ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          key: `${item.id}-${Date.now()}`,
          description: item.description,
          category: item.category,
          quantity: 1,
          unitPrice: item.unitPrice,
        },
      ];
    });
  }, []);

  const updateLine = (key: string, patch: Partial<CartLine>) =>
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) =>
    setCart((prev) => prev.filter((l) => l.key !== key));

  /* ── Totals ── */
  const subtotal = useMemo(
    () => cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
    [cart],
  );
  const discountAmount = (subtotal * discountPct) / 100;
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = (afterDiscount * taxPct) / 100;
  const total = afterDiscount + taxAmount;
  const selfAmount = (total * selfShare) / 100;
  const tpaAmount = total - selfAmount;

  /* ── Submit ── */
  async function submit() {
    if (!patient) {
      toast.error("Select a patient first.");
      return;
    }
    if (cart.length === 0) {
      toast.error("Add at least one item.");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch("/api/billing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          items: cart.map((l) => ({
            description: l.description,
            category: l.category,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
          discountAmount,
          taxAmount,
          dueDate: dueDate || undefined,
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to create invoice");
        return;
      }
      toast.success("Invoice created", {
        description: json.data?.invoiceNo ?? "",
      });
      router.push("/billing");
    } finally {
      setSaving(false);
    }
  }

  /* ─────────────────────────── Render ─────────────────────────── */
  return (
    <div className="space-y-4">
      <PageHeader
        title="New invoice"
        description="Build the bill from the catalog — use packages, then tweak discounts and payer split"
      />

      {/* Sticky patient bar */}
      <div className="sticky top-16 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-background/95 backdrop-blur border-b shadow-context">
        <div className="flex items-center gap-3">
          {patient ? (
            <>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                {patient.firstName[0]}
                {patient.lastName[0]}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {patient.firstName} {patient.lastName}
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  MRN {patient.mrn}
                  {patient.phone ? ` · ${patient.phone}` : ""}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-xs"
                onClick={() => {
                  setPatient(null);
                  setPatientQuery("");
                }}
              >
                Change patient
              </Button>
            </>
          ) : (
            <div className="relative w-full max-w-md">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search patient by name, MRN, or phone…"
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                onFocus={() => patientHits.length > 0 && setShowPatientHits(true)}
                onBlur={() => setTimeout(() => setShowPatientHits(false), 120)}
                className="pl-9"
              />
              {showPatientHits && patientHits.length > 0 && (
                <div className="absolute z-30 mt-1 w-full rounded-md border bg-popover shadow-lg overflow-hidden">
                  {patientHits.map((p) => (
                    <button
                      key={p.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setPatient(p);
                        setPatientQuery("");
                        setShowPatientHits(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold shrink-0">
                        {p.firstName[0]}
                        {p.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {p.firstName} {p.lastName}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          MRN {p.mrn}
                          {p.phone ? ` · ${p.phone}` : ""}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Three columns */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Catalog */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Catalog</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="bill-catalog-search"
                placeholder="/ search items…"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>

            {/* Category tabs */}
            {!catalogQuery && (
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const active = activeCategory === c.name;
                  return (
                    <button
                      key={c.name}
                      onClick={() => setActiveCategory(c.name)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Items */}
            <div className="space-y-1 max-h-[520px] overflow-y-auto">
              {visibleCatalog.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No items.
                </p>
              ) : (
                visibleCatalog.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addItem(item)}
                    className="flex w-full items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {item.description}
                      </div>
                      {item.children && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          Package · {item.children.length} items
                        </div>
                      )}
                    </div>
                    <div className="text-xs font-semibold tabular-nums shrink-0">
                      ₹{item.unitPrice.toLocaleString()}
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cart */}
        <Card className="lg:col-span-6">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              Cart
              <span className="text-xs font-normal text-muted-foreground">
                ({cart.length} item{cart.length === 1 ? "" : "s"})
              </span>
            </CardTitle>
            {cart.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setCart([])}
              >
                Clear
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {cart.length === 0 ? (
              <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                Add items from the catalog to build the invoice.
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((line) => (
                  <div
                    key={line.key}
                    className="grid grid-cols-12 items-center gap-2 rounded-md border bg-card px-2.5 py-2"
                  >
                    <div className="col-span-12 md:col-span-6">
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(line.key, { description: e.target.value })}
                        className="h-7 text-xs"
                      />
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {line.category}
                      </div>
                    </div>
                    <div className="col-span-4 md:col-span-2 flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() =>
                          updateLine(line.key, {
                            quantity: Math.max(1, line.quantity - 1),
                          })
                        }
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.key, {
                            quantity: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="h-7 text-xs text-center px-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() =>
                          updateLine(line.key, { quantity: line.quantity + 1 })
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={line.unitPrice}
                        onChange={(e) =>
                          updateLine(line.key, {
                            unitPrice: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        className="h-7 text-xs text-right"
                      />
                    </div>
                    <div className="col-span-3 md:col-span-1 text-xs font-semibold tabular-nums text-right">
                      ₹{(line.quantity * line.unitPrice).toLocaleString()}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-span-1 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeLine(line.key)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="lg:col-span-3 lg:sticky lg:top-40 lg:h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Gross" value={`₹${subtotal.toLocaleString()}`} />

            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Percent className="h-3 w-3" />
                Discount
              </label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={discountPct}
                  onChange={(e) => setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  className="h-7 w-16 text-xs text-right"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <Row
              label="  = discount"
              value={`− ₹${discountAmount.toLocaleString()}`}
              muted
            />

            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Percent className="h-3 w-3" />
                Tax
              </label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={taxPct}
                  onChange={(e) => setTaxPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  className="h-7 w-16 text-xs text-right"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <Row
              label="  = tax"
              value={`+ ₹${taxAmount.toLocaleString()}`}
              muted
            />

            <div className="border-t pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Net total</span>
                <span className="text-lg font-bold tabular-nums text-primary">
                  ₹{total.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payer split */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Payer split</span>
                <span className="text-muted-foreground tabular-nums">
                  Self {selfShare}% · TPA {100 - selfShare}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={selfShare}
                onChange={(e) => setSelfShare(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="mt-1 flex justify-between text-[11px] tabular-nums">
                <Badge variant="secondary" className="text-[10px]">
                  Self ₹{selfAmount.toLocaleString()}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  TPA ₹{tpaAmount.toLocaleString()}
                </Badge>
              </div>
            </div>

            {/* Due date + notes */}
            <div className="space-y-2 pt-2 border-t">
              <div>
                <label className="text-xs text-muted-foreground">Due date</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notes</label>
                <Textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-xs"
                  placeholder="Payment terms, remarks…"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-1">
              <Button onClick={submit} disabled={saving || cart.length === 0 || !patient}>
                <Save className="h-4 w-4" />
                {saving ? "Creating…" : `Create invoice · ₹${total.toLocaleString()}`}
              </Button>
              <Button variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className={cn(muted ? "text-muted-foreground" : "text-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          muted ? "text-muted-foreground" : "font-semibold",
        )}
      >
        {value}
      </span>
    </div>
  );
}
