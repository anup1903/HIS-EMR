import { Activity, HeartPulse, Stethoscope, ShieldCheck, Building2 } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen bg-background">
      {/* Left marketing panel */}
      <div
        className="relative hidden w-1/2 overflow-hidden text-white lg:flex lg:flex-col"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at top left, rgb(20 184 166 / 0.55), transparent 55%), radial-gradient(ellipse at bottom right, rgb(30 58 138 / 0.8), transparent 60%), linear-gradient(135deg, hsl(174 72% 30%) 0%, hsl(196 68% 26%) 45%, hsl(222 55% 12%) 100%)",
        }}
      >
        {/* Hex grid pattern */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.09]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="auth-hex"
              width="32"
              height="36"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M16 0 L32 9 L32 27 L16 36 L0 27 L0 9 Z"
                fill="none"
                stroke="white"
                strokeWidth="0.8"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-hex)" />
        </svg>

        {/* Glow blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgb(45 212 191 / 0.4) 0%, transparent 65%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-28 bottom-10 h-96 w-96 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgb(59 130 246 / 0.3) 0%, transparent 65%)",
          }}
        />

        {/* ECG heartbeat strip */}
        <svg
          aria-hidden
          viewBox="0 0 800 80"
          className="pointer-events-none absolute inset-x-0 bottom-20 h-16 w-full opacity-50"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="auth-ecg" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(94 234 212)" stopOpacity="0" />
              <stop offset="50%" stopColor="rgb(94 234 212)" stopOpacity="1" />
              <stop offset="100%" stopColor="rgb(94 234 212)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,40 L120,40 L140,40 L155,20 L170,60 L185,10 L200,55 L215,40 L340,40 L360,40 L375,20 L390,60 L405,10 L420,55 L435,40 L560,40 L580,40 L595,20 L610,60 L625,10 L640,55 L655,40 L800,40"
            fill="none"
            stroke="url(#auth-ecg)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-lg font-semibold">HIS System</div>
              <div className="text-[11px] uppercase tracking-widest text-white/60">
                Clinical Operating System
              </div>
            </div>
          </div>

          <div className="max-w-md space-y-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight">
              Modern care,{" "}
              <span className="text-teal-200">built for every ward.</span>
            </h1>
            <p className="text-white/75">
              One platform for OPD, IPD, Emergency, Pharmacy, Labs and Billing —
              with clinical decision support, real-time dashboards, and
              AI-assisted prescriptions built in.
            </p>

            <ul className="space-y-2 pt-2 text-sm">
              <Feature icon={HeartPulse} label="Live ward board with bedside vitals" />
              <Feature icon={Stethoscope} label="Role-based cockpits for every department" />
              <Feature icon={Activity} label="CDS rules + AI Rx suggestions" />
              <Feature icon={ShieldCheck} label="Audit-grade, RBAC-controlled EMR" />
            </ul>
          </div>

          <div className="text-[11px] text-white/50">
            © {new Date().getFullYear()} HIS System · Designed for clinicians.
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="relative flex w-full items-center justify-center bg-muted/30 p-4 sm:p-8 lg:w-1/2">
        {/* Mobile brand (shown only when left panel is hidden) */}
        <div className="absolute left-4 top-4 flex items-center gap-2 text-foreground lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          <span className="font-semibold">HIS System</span>
        </div>
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}

function Feature({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
        <Icon className="h-3 w-3 text-teal-200" />
      </span>
      <span className="text-white/85">{label}</span>
    </li>
  );
}
