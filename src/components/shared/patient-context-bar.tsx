import { AlertTriangle, ClipboardList, Droplet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PatientContextBarProps {
  patient: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date | string;
    gender: string;
    bloodGroup?: string | null;
    phone?: string | null;
    allergies?: string | null;
    chronicConditions?: string | null;
  };
  /** Render a small pulsing "LIVE" dot (e.g. to signal an open consultation). */
  live?: boolean;
  /** Optional right-side slot — typically CTA buttons. */
  children?: React.ReactNode;
  /** Pulls the bar tight to the page edges (useful inside padded <main>). */
  flush?: boolean;
}

function ageFromDob(dob: Date | string) {
  return Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
    ),
  );
}

/**
 * Darker-gradient patient context bar used at the top of Rx Pad, EMR,
 * consultation detail, and any other patient-scoped screen. Matches the
 * sidebar/login/hero palette.
 */
export function PatientContextBar({
  patient,
  live,
  children,
  flush,
}: PatientContextBarProps) {
  const age = ageFromDob(patient.dateOfBirth);
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border text-white shadow-lg",
        flush && "-mx-4 md:-mx-6 rounded-none border-x-0",
      )}
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top left, rgb(20 184 166 / 0.55), transparent 55%), radial-gradient(ellipse at bottom right, rgb(30 58 138 / 0.85), transparent 60%), linear-gradient(135deg, hsl(174 72% 28%) 0%, hsl(196 68% 22%) 45%, hsl(222 55% 12%) 100%)",
      }}
    >
      {/* Hex grid overlay */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.09]"
      >
        <defs>
          <pattern id="pctx-hex" width="22" height="25" patternUnits="userSpaceOnUse">
            <path
              d="M11 0 L22 6 L22 19 L11 25 L0 19 L0 6 Z"
              fill="none"
              stroke="white"
              strokeWidth="0.7"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#pctx-hex)" />
      </svg>

      {/* ECG strip across the bottom */}
      <svg
        aria-hidden
        viewBox="0 0 800 40"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-6 w-full opacity-40"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="pctx-ecg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(94 234 212)" stopOpacity="0" />
            <stop offset="50%" stopColor="rgb(94 234 212)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="rgb(94 234 212)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,20 L180,20 L200,20 L212,6 L224,34 L236,2 L248,32 L260,20 L420,20 L440,20 L452,6 L464,34 L476,2 L488,32 L500,20 L800,20"
          fill="none"
          stroke="url(#pctx-ecg)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="relative flex flex-wrap items-center gap-3 px-4 py-3 md:px-6">
        {/* Avatar */}
        <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur-sm font-semibold text-sm shrink-0">
          {patient.firstName[0]}
          {patient.lastName[0]}
          {live && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-success ring-2 ring-background/30" />
            </span>
          )}
        </div>

        {/* Identity */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-base font-semibold truncate">
              {patient.firstName} {patient.lastName}
            </div>
            {live && (
              <Badge className="border-success/40 bg-success/15 text-[10px] font-semibold uppercase tracking-wider text-success">
                LIVE
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-white/70 tabular-nums">
            MRN {patient.mrn} · {age}
            {patient.gender?.charAt(0)}
            {patient.phone ? ` · ${patient.phone}` : ""}
          </div>
        </div>

        {/* Blood group chip */}
        {patient.bloodGroup && (
          <Badge className="gap-1 border-white/25 bg-white/10 text-[11px] font-semibold text-white hover:bg-white/15">
            <Droplet className="h-3 w-3 text-rose-300" />
            {patient.bloodGroup.replace(/_POSITIVE$/, "+").replace(/_NEGATIVE$/, "−")}
          </Badge>
        )}

        {/* Allergy badge */}
        {patient.allergies && (
          <Badge className="gap-1 border-destructive/50 bg-destructive/20 text-[11px] text-white">
            <AlertTriangle className="h-3 w-3" />
            {patient.allergies}
          </Badge>
        )}

        {/* Chronic conditions */}
        {patient.chronicConditions && (
          <Badge className="gap-1 border-white/25 bg-white/10 text-[11px] text-white/90 max-w-xs truncate">
            <ClipboardList className="h-3 w-3" />
            {patient.chronicConditions}
          </Badge>
        )}

        {/* Right slot */}
        {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
      </div>
    </section>
  );
}
