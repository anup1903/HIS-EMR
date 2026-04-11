"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { flattenNav } from "@/lib/constants/nav-groups";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  UserPlus,
  CalendarPlus,
  FilePlus2,
  FlaskConical,
  Pill,
  Receipt,
  BedDouble,
  LogOut,
  Sun,
  Moon,
  Sparkles,
  User,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import type { Role } from "@prisma/client";

type PatientHit = {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
};

export function CommandPalette() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: Role })?.role;
  const { theme, setTheme } = useTheme();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientHit[]>([]);
  const [loading, setLoading] = useState(false);

  // Global shortcut: ⌘K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Debounced patient search
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setPatients([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const json = await res.json();
          setPatients(Array.isArray(json.data) ? json.data.slice(0, 8) : []);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(handle);
  }, [query, open]);

  const navItems = useMemo(() => flattenNav(role), [role]);

  const runAction = useCallback(
    (fn: () => void) => {
      setOpen(false);
      // Let the dialog close animation start before routing
      setTimeout(fn, 50);
    },
    [setOpen],
  );

  const quickActions = useMemo(
    () => [
      {
        id: "new-patient",
        label: "Register new patient",
        icon: UserPlus,
        shortcut: "N P",
        roles: ["ADMIN", "RECEPTIONIST", "DOCTOR", "NURSE"] as Role[],
        run: () => router.push("/patients/new"),
      },
      {
        id: "new-appointment",
        label: "Book appointment",
        icon: CalendarPlus,
        shortcut: "N A",
        roles: ["ADMIN", "RECEPTIONIST", "DOCTOR"] as Role[],
        run: () => router.push("/appointments"),
      },
      {
        id: "new-consult",
        label: "Start OPD consultation",
        icon: FilePlus2,
        shortcut: "N C",
        roles: ["ADMIN", "DOCTOR"] as Role[],
        run: () => router.push("/opd/consultations/new"),
      },
      {
        id: "new-rx",
        label: "Write a prescription (Rx Pad)",
        icon: Pill,
        shortcut: "N R",
        roles: ["ADMIN", "DOCTOR"] as Role[],
        run: () => router.push("/opd/rx-pad"),
      },
      {
        id: "new-lab",
        label: "Order lab tests",
        icon: FlaskConical,
        roles: ["ADMIN", "DOCTOR", "NURSE"] as Role[],
        run: () => router.push("/laboratory"),
      },
      {
        id: "new-invoice",
        label: "Create invoice",
        icon: Receipt,
        roles: ["ADMIN", "RECEPTIONIST", "ACCOUNTANT"] as Role[],
        run: () => router.push("/billing"),
      },
      {
        id: "admit",
        label: "Admit patient (IPD)",
        icon: BedDouble,
        roles: ["ADMIN", "DOCTOR", "NURSE"] as Role[],
        run: () => router.push("/ipd"),
      },
    ],
    [router],
  );

  const visibleActions = quickActions.filter((a) => !role || a.roles.includes(role));

  return (
    <CommandDialog open={open} onOpenChange={setOpen} label="Search patients, modules, and actions">
      <CommandInput
        placeholder="Type to search patients, modules, or actions…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? "Searching…" : "No results. Try a patient name, MRN, or module name."}
        </CommandEmpty>

        {/* Patients (dynamic) */}
        {patients.length > 0 && (
          <>
            <CommandGroup heading="Patients">
              {patients.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`patient-${p.id}-${p.firstName}-${p.lastName}-${p.mrn}-${p.phone ?? ""}`}
                  onSelect={() => runAction(() => router.push(`/patients/${p.id}`))}
                >
                  <User className="text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {p.firstName} {p.lastName}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      MRN {p.mrn}
                      {p.phone ? ` · ${p.phone}` : ""}
                    </span>
                  </div>
                  <CommandShortcut>Open ↵</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Quick actions */}
        {visibleActions.length > 0 && (
          <>
            <CommandGroup heading="Quick actions">
              {visibleActions.map((a) => {
                const Icon = a.icon;
                return (
                  <CommandItem
                    key={a.id}
                    value={`action-${a.id}-${a.label}`}
                    onSelect={() => runAction(a.run)}
                  >
                    <Icon className="text-primary" />
                    <span>{a.label}</span>
                    {a.shortcut && <CommandShortcut>{a.shortcut}</CommandShortcut>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Modules */}
        <CommandGroup heading="Go to">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem
                key={item.href}
                value={`nav-${item.href}-${item.title}-${(item.keywords ?? []).join(" ")}`}
                onSelect={() => runAction(() => router.push(item.href))}
              >
                <Icon className="text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="text-sm">{item.title}</span>
                  {item.description && (
                    <span className="text-[11px] text-muted-foreground line-clamp-1">
                      {item.description}
                    </span>
                  )}
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* System */}
        <CommandGroup heading="System">
          <CommandItem
            value="system-theme-toggle"
            onSelect={() => runAction(() => setTheme(theme === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
            <span>Toggle {theme === "dark" ? "light" : "dark"} mode</span>
            <CommandShortcut>⌘⇧L</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="system-my-day"
            onSelect={() => runAction(() => router.push("/dashboard"))}
          >
            <Sparkles />
            <span>Go to My Day</span>
            <CommandShortcut>G H</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="system-sign-out"
            onSelect={() => runAction(() => signOut({ callbackUrl: "/login" }))}
          >
            <LogOut className="text-destructive" />
            <span className="text-destructive">Sign out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
