"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  UserPlus,
  CalendarPlus,
  Receipt,
  Ticket,
  Users,
  Calendar,
  Clock,
  Phone,
} from "lucide-react";
import { StatsCard } from "@/components/shared/stats-card";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { MyDayHeader } from "./my-day-header";
import { cn } from "@/lib/utils";

interface PatientHit {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  gender?: string;
  dateOfBirth?: string;
}

interface AppointmentRow {
  id: string;
  date: string;
  appointmentNo: string;
  startTime: string;
  status: string;
  tokenNumber: number | null;
  patient: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  doctor: { user: { name: string } };
}

interface Props {
  name: string;
}

export function ReceptionDay({ name }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<PatientHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [recent, setRecent] = useState<PatientHit[]>([]);
  const [stats, setStats] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    checkedIn: 0,
    waiting: 0,
  });

  /* Initial load: today's appointments + recent patients + counts */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [apRes, paRes] = await Promise.all([
          fetch("/api/appointments?limit=30"),
          fetch("/api/patients?limit=8"),
        ]);
        const apJson = await apRes.json();
        const paJson = await paRes.json();
        if (cancelled) return;

        const today = new Date();
        const y = today.getFullYear();
        const m = today.getMonth();
        const d = today.getDate();
        const list: AppointmentRow[] = (apJson.data ?? []).filter((a: AppointmentRow) => {
          const dt = new Date(a.date);
          return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
        });
        setAppointments(list);
        setRecent(paJson.data ?? []);
        setStats({
          totalPatients: paJson.meta?.total ?? (paJson.data?.length ?? 0),
          todayAppointments: list.length,
          checkedIn: list.filter((a) => a.status === "CHECKED_IN").length,
          waiting: list.filter((a) => a.status === "SCHEDULED" || a.status === "CHECKED_IN").length,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Debounced search */
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    const h = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await fetch(`/api/patients/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        setHits(Array.isArray(json.data) ? json.data : []);
      } finally {
        setSearching(false);
      }
    }, 160);
    return () => clearTimeout(h);
  }, [q]);

  const openFirst = () => {
    if (hits.length > 0) router.push(`/patients/${hits[0].id}`);
  };

  return (
    <div className="space-y-6">
      <MyDayHeader
        name={name}
        role="RECEPTIONIST"
        subtitle="Find a patient, register a new one, or manage today's flow"
      />

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Patients"
          value={stats.totalPatients}
          icon={Users}
          description="Registered"
        />
        <StatsCard
          title="Today's Appts"
          value={stats.todayAppointments}
          icon={Calendar}
          accent="primary"
          description="Scheduled"
        />
        <StatsCard
          title="Checked-in"
          value={stats.checkedIn}
          icon={Ticket}
          accent="info"
          description="At clinic"
        />
        <StatsCard
          title="Waiting"
          value={stats.waiting}
          icon={Clock}
          accent="warning"
          description="In queue"
        />
      </div>

      {/* Search-first finder */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Find a patient</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              openFirst();
            }}
            className="relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, MRN, or phone — then press Enter"
              className="pl-9 h-11 text-base"
            />
          </form>

          <div className="mt-3 grid gap-2">
            {searching && (
              <div className="text-xs text-muted-foreground px-1">Searching…</div>
            )}
            {!searching && q.length >= 2 && hits.length === 0 && (
              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                No matches. Want to{" "}
                <Link href="/patients/new" className="text-primary underline">
                  register a new patient
                </Link>
                ?
              </div>
            )}
            {hits.map((p) => (
              <Link
                key={p.id}
                href={`/patients/${p.id}`}
                className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 hover:bg-accent transition-colors"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                  {p.firstName[0]}
                  {p.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {p.firstName} {p.lastName}
                  </div>
                  <div className="text-[11px] text-muted-foreground tabular-nums truncate">
                    MRN {p.mrn}
                    {p.phone ? ` · ${p.phone}` : ""}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">Open →</span>
              </Link>
            ))}
          </div>

          {/* Quick actions */}
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <QuickAction
              href="/patients/new"
              icon={UserPlus}
              label="Register patient"
              shortcut="N P"
            />
            <QuickAction
              href="/appointments"
              icon={CalendarPlus}
              label="Book appointment"
              shortcut="N A"
            />
            <QuickAction
              href="/queue"
              icon={Ticket}
              label="Issue token"
            />
            <QuickAction href="/billing" icon={Receipt} label="New invoice" />
          </div>
        </CardContent>
      </Card>

      {/* Today's appointments + recent patients */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Today&apos;s appointments</CardTitle>
            <Link href="/appointments" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {appointments.length === 0 ? (
              <div className="p-4">
                <MedicalEmptyState
                  illustration="calendar"
                  title="No appointments today"
                  description="When patients check in, they'll show up here."
                  action={{ label: "Book appointment", href: "/appointments" }}
                />
              </div>
            ) : (
              <div className="divide-y">
                {appointments.slice(0, 12).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="text-sm font-semibold tabular-nums w-14 shrink-0">
                      {a.startTime}
                    </div>
                    <Link
                      href={`/patients/${a.patient.id}`}
                      className="flex-1 min-w-0 group"
                    >
                      <div className="text-sm font-medium truncate group-hover:text-primary">
                        {a.patient.firstName} {a.patient.lastName}
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums truncate">
                        MRN {a.patient.mrn} · Dr. {a.doctor.user.name}
                      </div>
                    </Link>
                    {a.patient.phone && (
                      <a
                        href={`tel:${a.patient.phone}`}
                        className="text-[11px] text-muted-foreground hover:text-primary hidden md:flex items-center gap-1"
                      >
                        <Phone className="h-3 w-3" />
                        {a.patient.phone}
                      </a>
                    )}
                    <StatusPill status={a.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent patients</CardTitle>
            <Link href="/patients" className="text-xs text-primary hover:underline">
              All →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <div className="p-4">
                <MedicalEmptyState
                  illustration="inbox"
                  title="No recent patients"
                  action={{ label: "Register patient", href: "/patients/new" }}
                />
              </div>
            ) : (
              <div className="divide-y">
                {recent.slice(0, 8).map((p) => (
                  <Link
                    key={p.id}
                    href={`/patients/${p.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                      {p.firstName[0]}
                      {p.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {p.firstName} {p.lastName}
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums truncate">
                        MRN {p.mrn}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  shortcut,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
}) {
  return (
    <Button asChild variant="outline" className="h-auto justify-start py-2.5">
      <Link href={href}>
        <Icon className="h-4 w-4 text-primary" />
        <span className="flex-1 text-left text-sm">{label}</span>
        {shortcut && <kbd className="ml-2">{shortcut}</kbd>}
      </Link>
    </Button>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    SCHEDULED: { label: "Scheduled", cls: "bg-muted text-muted-foreground" },
    CHECKED_IN: { label: "Checked in", cls: "bg-info/10 text-info" },
    IN_PROGRESS: { label: "In room", cls: "bg-primary/10 text-primary" },
    COMPLETED: { label: "Done", cls: "bg-success/10 text-success" },
    CANCELLED: { label: "Cancelled", cls: "bg-destructive/10 text-destructive" },
    NO_SHOW: { label: "No show", cls: "bg-warning/10 text-warning" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <Badge className={cn("text-[10px] font-medium border-0", m.cls)}>{m.label}</Badge>
  );
}
