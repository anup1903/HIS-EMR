import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyIllustration =
  | "stethoscope"
  | "ecg"
  | "pill"
  | "calendar"
  | "lab"
  | "bed"
  | "inbox";

interface MedicalEmptyStateProps {
  illustration?: EmptyIllustration;
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}

/**
 * Branded empty state — tiny inline SVG medical illustration on a soft
 * teal gradient chip, title, description, and optional CTA.
 */
export function MedicalEmptyState({
  illustration = "ecg",
  title,
  description,
  action,
  className,
}: MedicalEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center",
        className,
      )}
    >
      <Illustration kind={illustration} />
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      )}
      {action && (
        <div className="mt-3">
          {action.href ? (
            <Button asChild size="sm">
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ) : (
            <Button size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────── Inline SVG illustrations ─────────── */
function Illustration({ kind }: { kind: EmptyIllustration }) {
  return (
    <div
      className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top left, rgb(20 184 166 / 0.18), transparent 55%), radial-gradient(ellipse at bottom right, rgb(30 58 138 / 0.18), transparent 60%), linear-gradient(135deg, rgb(240 253 250) 0%, rgb(236 254 255) 45%, rgb(239 246 255) 100%)",
      }}
    >
      {/* Hex grid */}
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full opacity-[0.10]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id={`ms-hex-${kind}`} width="14" height="16" patternUnits="userSpaceOnUse">
            <path
              d="M7 0 L14 4 L14 12 L7 16 L0 12 L0 4 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-primary"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#ms-hex-${kind})`} />
      </svg>

      <div className="relative">{ART[kind]}</div>
    </div>
  );
}

const ART: Record<EmptyIllustration, React.ReactNode> = {
  ecg: (
    <svg
      viewBox="0 0 64 40"
      className="h-12 w-16 text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M0 20 L14 20 L18 8 L24 32 L30 4 L36 28 L40 20 L64 20" />
    </svg>
  ),
  stethoscope: (
    <svg viewBox="0 0 64 64" className="h-14 w-14 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8 L16 26 A10 10 0 0 0 36 26 L36 8" />
      <path d="M26 36 L26 44 A10 10 0 0 0 46 44 L46 34" />
      <circle cx="50" cy="30" r="5" />
    </svg>
  ),
  pill: (
    <svg viewBox="0 0 64 64" className="h-14 w-14 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="10" y="22" width="44" height="20" rx="10" />
      <line x1="32" y1="22" x2="32" y2="42" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 64 64" className="h-14 w-14 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="10" y="14" width="44" height="40" rx="4" />
      <line x1="10" y1="26" x2="54" y2="26" />
      <line x1="22" y1="8" x2="22" y2="20" />
      <line x1="42" y1="8" x2="42" y2="20" />
      <circle cx="24" cy="38" r="2.5" fill="currentColor" />
      <circle cx="34" cy="38" r="2.5" fill="currentColor" />
      <circle cx="44" cy="38" r="2.5" fill="currentColor" />
    </svg>
  ),
  lab: (
    <svg viewBox="0 0 64 64" className="h-14 w-14 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 6 L22 26 L10 52 A6 6 0 0 0 16 60 L48 60 A6 6 0 0 0 54 52 L42 26 L42 6" />
      <line x1="18" y1="6" x2="46" y2="6" />
      <circle cx="26" cy="46" r="2" fill="currentColor" />
      <circle cx="36" cy="42" r="2" fill="currentColor" />
      <circle cx="32" cy="52" r="2" fill="currentColor" />
    </svg>
  ),
  bed: (
    <svg viewBox="0 0 64 64" className="h-14 w-14 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 46 L6 20 L26 20 L26 34 L58 34 L58 46" />
      <line x1="2" y1="46" x2="62" y2="46" />
      <circle cx="16" cy="28" r="4" />
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 64 64" className="h-14 w-14 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 36 L18 12 L46 12 L58 36 L58 52 L6 52 Z" />
      <path d="M6 36 L22 36 L26 42 L38 42 L42 36 L58 36" />
    </svg>
  ),
};
