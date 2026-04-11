import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/helpers/rbac";
import { redirect, notFound } from "next/navigation";
import { PrintButton } from "./print-button";
import { HeartPulse, Building2, Phone, Mail, Globe } from "lucide-react";

export const dynamic = "force-dynamic";

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function ageFromDob(dob: Date) {
  return Math.max(
    0,
    Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25)),
  );
}

export default async function PrintPrescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const [rx, hospital] = await Promise.all([
    prisma.prescription.findUnique({
      where: { id },
      include: {
        patient: true,
        items: { include: { drug: true } },
      },
    }),
    prisma.hospital.findFirst(),
  ]);

  if (!rx) notFound();

  const patient = rx.patient;
  const age = ageFromDob(patient.dateOfBirth);

  return (
    <div className="mx-auto max-w-[800px] p-6 print:p-0">
      {/* Screen-only print toolbar */}
      <div className="mb-4 flex items-center justify-between no-print">
        <a
          href="/pharmacy"
          className="text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back to pharmacy
        </a>
        <PrintButton />
      </div>

      {/* Letterhead */}
      <article className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none">
        {/* Gradient header band (prints in color when "Background graphics" is on) */}
        <header
          className="relative overflow-hidden px-8 py-6 text-white print-color-exact"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at top left, rgb(20 184 166 / 0.55), transparent 55%), radial-gradient(ellipse at bottom right, rgb(30 58 138 / 0.85), transparent 60%), linear-gradient(135deg, hsl(174 72% 28%) 0%, hsl(196 68% 22%) 45%, hsl(222 55% 12%) 100%)",
          }}
        >
          {/* Hex grid */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.10]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="print-hex"
                width="22"
                height="25"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M11 0 L22 6 L22 19 L11 25 L0 19 L0 6 Z"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.7"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#print-hex)" />
          </svg>
          {/* ECG strip */}
          <svg
            aria-hidden
            viewBox="0 0 800 50"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-6 w-full opacity-45"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="print-ecg" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgb(94 234 212)" stopOpacity="0" />
                <stop offset="50%" stopColor="rgb(94 234 212)" stopOpacity="0.95" />
                <stop offset="100%" stopColor="rgb(94 234 212)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,25 L180,25 L200,25 L212,8 L224,42 L236,2 L248,40 L260,25 L420,25 L440,25 L452,8 L464,42 L476,2 L488,40 L500,25 L800,25"
              fill="none"
              stroke="url(#print-ecg)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div className="relative flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30 backdrop-blur-sm">
              <Building2 className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xl font-bold tracking-tight leading-tight">
                {hospital?.name ?? "HIS System Hospital"}
              </div>
              <div className="text-[11px] uppercase tracking-widest text-teal-200">
                Clinical Operating System
              </div>
              {hospital && (
                <div className="mt-1 text-[11px] text-white/80 leading-snug">
                  {hospital.address}, {hospital.city}, {hospital.state}{" "}
                  {hospital.zipCode}
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-white/85">
                {hospital?.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {hospital.phone}
                  </span>
                )}
                {hospital?.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {hospital.email}
                  </span>
                )}
                {hospital?.website && (
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {hospital.website}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right text-[11px] leading-tight">
              <div className="text-[10px] uppercase tracking-widest text-teal-200">
                Prescription
              </div>
              <div className="font-mono text-base font-bold tracking-tight">
                {rx.prescriptionNo}
              </div>
              <div className="text-white/80">{fmt(rx.createdAt)}</div>
            </div>
          </div>
        </header>

        {/* Patient panel */}
        <section className="grid gap-0 border-b border-slate-200 px-8 py-4 text-sm md:grid-cols-2">
          <div>
            <Label>Patient</Label>
            <div className="font-semibold">
              {patient.firstName} {patient.lastName}
            </div>
            <div className="text-[11px] text-slate-500 tabular-nums">
              MRN {patient.mrn} · {age}
              {patient.gender?.charAt(0)}
              {patient.bloodGroup
                ? ` · ${patient.bloodGroup
                    .replace(/_POSITIVE$/, "+")
                    .replace(/_NEGATIVE$/, "−")}`
                : ""}
            </div>
          </div>
          <div>
            <Label>Contact</Label>
            <div className="text-[12px]">{patient.phone ?? "—"}</div>
            <div className="text-[11px] text-slate-500">{patient.email ?? ""}</div>
          </div>
          {patient.allergies && (
            <div className="md:col-span-2 mt-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-[12px] text-rose-700 print-color-exact">
              <span className="font-semibold">⚠ Known allergies:</span>{" "}
              {patient.allergies}
            </div>
          )}
        </section>

        {/* Rx body */}
        <section className="px-8 py-6">
          <div className="mb-3 flex items-center gap-2 text-slate-700">
            <RxSymbol />
            <span className="text-lg font-semibold tracking-tight">
              Prescription
            </span>
          </div>

          {rx.notes && (
            <p className="mb-4 whitespace-pre-wrap text-[12px] text-slate-600">
              {rx.notes}
            </p>
          )}

          {rx.items.length === 0 ? (
            <p className="text-sm text-slate-500">No medications.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-300 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="pb-2 pr-2">#</th>
                  <th className="pb-2 pr-2">Medication</th>
                  <th className="pb-2 pr-2">Dose</th>
                  <th className="pb-2 pr-2">Route</th>
                  <th className="pb-2 pr-2">Frequency</th>
                  <th className="pb-2 pr-2">Duration</th>
                  <th className="pb-2 pr-2 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {rx.items.map((it, idx) => (
                  <tr key={it.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-2 tabular-nums text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="py-2 pr-2">
                      <div className="font-semibold">{it.drug.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {it.drug.genericName} · {it.drug.strength} ·{" "}
                        {it.drug.dosageForm}
                      </div>
                      {it.instructions && (
                        <div className="mt-0.5 text-[11px] italic text-slate-600">
                          {it.instructions}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-2 tabular-nums">{it.dosage}</td>
                    <td className="py-2 pr-2">{it.route}</td>
                    <td className="py-2 pr-2">{it.frequency}</td>
                    <td className="py-2 pr-2">{it.duration}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {it.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Signature block */}
        <section className="grid grid-cols-2 gap-8 border-t border-slate-200 px-8 py-5 text-[12px]">
          <div>
            <Label>Prescribed by</Label>
            <div className="font-semibold">{rx.prescribedBy}</div>
            <div className="text-[11px] text-slate-500">
              {fmt(rx.createdAt)}
            </div>
          </div>
          <div className="text-right">
            <div className="mb-8 text-[10px] uppercase tracking-widest text-slate-400">
              Signature & seal
            </div>
            <div className="mt-8 border-t border-slate-400 pt-1 text-[11px] text-slate-500">
              Signature of prescribing physician
            </div>
          </div>
        </section>

        {/* Footer band */}
        <footer
          className="relative overflow-hidden px-8 py-3 text-[10px] text-white print-color-exact"
          style={{
            backgroundImage:
              "linear-gradient(90deg, hsl(174 72% 28%), hsl(196 68% 22%), hsl(222 55% 14%))",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1">
              <HeartPulse className="h-3 w-3" />
              Generated electronically by HIS System · not valid without signature
            </span>
            <span className="tabular-nums text-white/80">
              Printed {new Date().toLocaleString()}
            </span>
          </div>
        </footer>
      </article>

      {/* Print rules */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          .no-print { display: none !important; }
          .print-color-exact {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-widest text-slate-400">
      {children}
    </div>
  );
}

function RxSymbol() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white font-serif text-xl">
      ℞
    </span>
  );
}
