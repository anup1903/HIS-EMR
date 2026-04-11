import { Activity, HeartPulse, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface HeroBannerProps {
  name: string;
  role: string;
  subtitle?: string;
}

/**
 * "Classic HIS" hero banner — teal/blue gradient with medical SVG motifs.
 *
 * - Pure CSS + inline SVG, no external images (plays nicely with Docker/air-gapped)
 * - Three decorative layers:
 *     1. Radial gradient background (teal → deep blue)
 *     2. Hex-grid medical pattern (subtle, repeating)
 *     3. Foreground icons: pulse ring + stethoscope + heart ECG
 * - Time-of-day greeting with role context
 */
export function HeroBanner({ name, role, subtitle }: HeroBannerProps) {
  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? "Still up"
      : hour < 12
        ? "Good morning"
        : hour < 17
          ? "Good afternoon"
          : "Good evening";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const firstName = name.split(" ")[0];
  const roleLabel = role.replace("_", " ").toLowerCase();

  return (
    <section
      aria-label="Dashboard hero"
      className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary via-teal-700 to-slate-900 text-white shadow-xl"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top left, rgb(20 184 166 / 0.55), transparent 55%), radial-gradient(ellipse at bottom right, rgb(30 58 138 / 0.7), transparent 60%), linear-gradient(135deg, hsl(174 72% 32%) 0%, hsl(196 68% 28%) 45%, hsl(222 55% 14%) 100%)",
      }}
    >
      {/* Layer 1 — Hex grid pattern */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.09]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="hex"
            width="28"
            height="32"
            patternUnits="userSpaceOnUse"
            patternTransform="scale(1.2) rotate(0)"
          >
            <path
              d="M14 0 L28 8 L28 24 L14 32 L0 24 L0 8 Z"
              fill="none"
              stroke="white"
              strokeWidth="0.8"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hex)" />
      </svg>

      {/* Layer 2 — Large pulse rings bottom-right */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-24 h-80 w-80 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgb(45 212 191 / 0.35) 0%, transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-6 top-6 h-16 w-16 rounded-full border border-white/20"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-2 top-2 h-24 w-24 rounded-full border border-white/10"
      />

      {/* Layer 3 — ECG heartbeat line across the bottom */}
      <svg
        aria-hidden
        viewBox="0 0 800 80"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-14 w-full opacity-40"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="ecgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(94 234 212)" stopOpacity="0" />
            <stop offset="50%" stopColor="rgb(94 234 212)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="rgb(94 234 212)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,40 L120,40 L140,40 L155,20 L170,60 L185,10 L200,55 L215,40 L340,40 L360,40 L375,20 L390,60 L405,10 L420,55 L435,40 L560,40 L580,40 L595,20 L610,60 L625,10 L640,55 L655,40 L800,40"
          fill="none"
          stroke="url(#ecgGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Content */}
      <div className="relative grid gap-4 px-5 py-6 md:grid-cols-[1fr_auto] md:items-center md:px-8 md:py-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge className="border-white/20 bg-white/10 text-[10px] font-medium uppercase tracking-wider text-white hover:bg-white/15">
              <HeartPulse className="mr-1 h-3 w-3" />
              HIS · Clinical OS
            </Badge>
            <Badge className="border-white/20 bg-white/10 text-[10px] font-medium text-white/90 hover:bg-white/15">
              {roleLabel}
            </Badge>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
            {greeting}, <span className="text-teal-200">{firstName}</span>
          </h1>
          <p className="mt-1 max-w-xl text-sm text-white/75">
            {subtitle ?? "Your hospital operating system — patients, wards, orders, and billing in one place."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5">
              <Activity className="h-3 w-3" />
              {today}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5">
              <Stethoscope className="h-3 w-3" />
              Live vitals connected
            </span>
          </div>
        </div>

        {/* Right-side decorative medical illustration */}
        <div className="hidden md:block">
          <MedicalBadgeArt />
        </div>
      </div>
    </section>
  );
}

/**
 * Decorative circular medallion with a stethoscope + pulse ring.
 * Entirely inline SVG so it ships with the bundle.
 */
function MedicalBadgeArt() {
  return (
    <div className="relative h-28 w-28">
      {/* Outer rings */}
      <div className="absolute inset-0 rounded-full border border-white/20" />
      <div className="absolute inset-2 rounded-full border border-white/15" />
      <div className="absolute inset-4 rounded-full bg-white/5 backdrop-blur-sm" />
      {/* Center icon */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full text-teal-200"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Plus / medical cross */}
        <rect
          x="42"
          y="28"
          width="16"
          height="44"
          rx="3"
          fill="currentColor"
          opacity="0.9"
        />
        <rect
          x="28"
          y="42"
          width="44"
          height="16"
          rx="3"
          fill="currentColor"
          opacity="0.9"
        />
        {/* Pulse circle */}
        <circle
          cx="50"
          cy="50"
          r="36"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.5"
        />
      </svg>
    </div>
  );
}
