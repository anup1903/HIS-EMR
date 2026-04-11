"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus,
  Calendar as CalendarIcon,
  List,
  ChevronLeft,
  ChevronRight,
  Clock,
  User as UserIcon,
  Stethoscope,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/* ─────────────────────────── Types ─────────────────────────── */
interface Doctor {
  id: string;
  specialization: string;
  user: { name: string };
  department?: { name?: string };
}

interface Appointment {
  id: string;
  appointmentNo: string;
  date: string;
  startTime: string;
  endTime: string;
  status:
    | "SCHEDULED"
    | "CHECKED_IN"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED"
    | "NO_SHOW";
  type: string;
  tokenNumber?: number | null;
  reason?: string | null;
  patient: { id: string; mrn: string; firstName: string; lastName: string };
  doctor: { id: string; user: { name: string } };
}

/* ─────────────────────────── Utils ─────────────────────────── */
const STATUS_STYLES: Record<
  Appointment["status"],
  { bg: string; border: string; label: string; dot: string }
> = {
  SCHEDULED: {
    bg: "bg-info/10 hover:bg-info/15",
    border: "border-info/30",
    label: "Scheduled",
    dot: "bg-info",
  },
  CHECKED_IN: {
    bg: "bg-primary/10 hover:bg-primary/15",
    border: "border-primary/40",
    label: "Checked-in",
    dot: "bg-primary",
  },
  IN_PROGRESS: {
    bg: "bg-warning/10 hover:bg-warning/15",
    border: "border-warning/40",
    label: "In Progress",
    dot: "bg-warning",
  },
  COMPLETED: {
    bg: "bg-success/10 hover:bg-success/15",
    border: "border-success/30",
    label: "Completed",
    dot: "bg-success",
  },
  CANCELLED: {
    bg: "bg-muted hover:bg-muted/80",
    border: "border-border",
    label: "Cancelled",
    dot: "bg-muted-foreground",
  },
  NO_SHOW: {
    bg: "bg-destructive/10 hover:bg-destructive/15",
    border: "border-destructive/30",
    label: "No-show",
    dot: "bg-destructive",
  },
};

/** Convert "HH:MM" → minutes since midnight. */
function toMinutes(hhmm: string): number {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

const HOUR_HEIGHT = 56; // px per hour
const MIN_HOUR = 8; // 08:00
const MAX_HOUR = 20; // 20:00
const SLOT_MINUTES = 15;

/* ─────────────────────────── Page ─────────────────────────── */
export default function AppointmentsPage() {
  const [view, setView] = useState<"day" | "list">("day");
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  /* Fetch doctors once */
  useEffect(() => {
    fetch("/api/doctors")
      .then((r) => r.json())
      .then((d) => setDoctors(d.data ?? []))
      .catch(() => setDoctors([]));
  }, []);

  /* Fetch appointments for chosen date */
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date: formatIsoDate(date),
        limit: "200",
      });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/appointments?${params}`);
      const json = await res.json();
      setAppointments(Array.isArray(json.data) ? json.data : []);
    } finally {
      setLoading(false);
    }
  }, [date, statusFilter]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  /* Only show doctors who actually have appointments on this day.
     If nothing exists, still show a handful so the calendar isn't empty. */
  const activeDoctors = useMemo(() => {
    const idSet = new Set(appointments.map((a) => a.doctor.id));
    if (idSet.size === 0) return doctors.slice(0, 6);
    return doctors.filter((d) => idSet.has(d.id));
  }, [doctors, appointments]);

  /* Index appointments by doctorId */
  const apptsByDoctor = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const a of appointments) {
      (map[a.doctor.id] ??= []).push(a);
    }
    return map;
  }, [appointments]);

  /* Keyboard shortcuts: ← / → to move day, T for today */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setDate((d) => addDays(d, -1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setDate((d) => addDays(d, 1));
      } else if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        setDate(d);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const isToday = useMemo(() => {
    const now = new Date();
    return (
      now.getFullYear() === date.getFullYear() &&
      now.getMonth() === date.getMonth() &&
      now.getDate() === date.getDate()
    );
  }, [date]);

  const displayDate = date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  async function updateStatus(id: string, status: Appointment["status"]) {
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(`Marked as ${STATUS_STYLES[status].label}`);
      fetchAppointments();
    } else {
      toast.error("Failed to update status");
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Appointments" description="Day calendar with doctor columns">
        <Button asChild>
          <Link href="/appointments/new">
            <Plus className="mr-2 h-4 w-4" />
            Book appointment
          </Link>
        </Button>
      </PageHeader>

      {/* Date navigator + filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDate((d) => addDays(d, -1))}
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={isToday ? "default" : "outline"}
              size="sm"
              onClick={() => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                setDate(d);
              }}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDate((d) => addDays(d, 1))}
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Input
            type="date"
            className="w-44"
            value={formatIsoDate(date)}
            onChange={(e) => {
              const parts = e.target.value.split("-").map(Number);
              if (parts.length === 3)
                setDate(new Date(parts[0], parts[1] - 1, parts[2]));
            }}
          />

          <div className="hidden md:block text-sm font-medium">
            {displayDate}
            <span className="ml-2 text-xs text-muted-foreground tabular-nums">
              · {appointments.length} appt{appointments.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <select
                className="bg-transparent h-8 rounded-md border px-2 text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="CHECKED_IN">Checked-in</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="NO_SHOW">No-show</option>
              </select>
            </div>
            <div className="flex gap-1">
              <Button
                variant={view === "day" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("day")}
                aria-label="Day view"
              >
                <CalendarIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={view === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("list")}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="w-full flex items-center gap-3 text-[10px] text-muted-foreground">
            <LegendDot color="bg-info" label="Scheduled" />
            <LegendDot color="bg-primary" label="Checked-in" />
            <LegendDot color="bg-warning" label="In Progress" />
            <LegendDot color="bg-success" label="Completed" />
            <LegendDot color="bg-destructive" label="No-show" />
            <span className="ml-auto hidden md:inline">
              <kbd>←</kbd>/<kbd>→</kbd> navigate · <kbd>T</kbd> today
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Body */}
      {view === "day" ? (
        <DayCalendar
          loading={loading}
          doctors={activeDoctors}
          apptsByDoctor={apptsByDoctor}
          isToday={isToday}
          onUpdateStatus={updateStatus}
        />
      ) : (
        <ListView
          appointments={appointments}
          loading={loading}
          onUpdateStatus={updateStatus}
        />
      )}
    </div>
  );
}

/* ─────────────────────────── Legend ─────────────────────────── */
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      {label}
    </span>
  );
}

/* ─────────────────────────── Day Calendar ─────────────────────────── */
function DayCalendar({
  loading,
  doctors,
  apptsByDoctor,
  isToday,
  onUpdateStatus,
}: {
  loading: boolean;
  doctors: Doctor[];
  apptsByDoctor: Record<string, Appointment[]>;
  isToday: boolean;
  onUpdateStatus: (id: string, status: Appointment["status"]) => void;
}) {
  const totalHours = MAX_HOUR - MIN_HOUR;
  const totalHeight = totalHours * HOUR_HEIGHT;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes() - MIN_HOUR * 60;
  const nowTop = Math.max(0, Math.min(totalHeight, (nowMinutes / 60) * HOUR_HEIGHT));

  if (doctors.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <CalendarIcon className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : "No doctors available for this date."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <div className="relative flex min-w-max" style={{ height: totalHeight + 48 }}>
            {/* Time gutter */}
            <div className="sticky left-0 z-20 shrink-0 w-16 bg-background border-r">
              <div className="h-12 border-b bg-muted/40" />
              {Array.from({ length: totalHours }).map((_, i) => (
                <div
                  key={i}
                  className="relative text-[10px] text-muted-foreground tabular-nums pr-1 text-right"
                  style={{ height: HOUR_HEIGHT }}
                >
                  <span className="absolute -top-1.5 right-1 bg-background px-0.5">
                    {String(MIN_HOUR + i).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Doctor columns */}
            {doctors.map((doctor) => {
              const list = (apptsByDoctor[doctor.id] ?? [])
                .slice()
                .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

              return (
                <div
                  key={doctor.id}
                  className="relative shrink-0 w-56 border-r last:border-r-0"
                >
                  {/* Column header */}
                  <div className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b bg-background px-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-semibold shrink-0">
                      {doctor.user.name
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div className="min-w-0 leading-tight">
                      <div className="text-sm font-semibold truncate">
                        Dr. {doctor.user.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {doctor.specialization}
                      </div>
                    </div>
                    <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                      {list.length}
                    </span>
                  </div>

                  {/* Hour grid background + appointments */}
                  <div className="relative" style={{ height: totalHeight }}>
                    {Array.from({ length: totalHours * (60 / SLOT_MINUTES) }).map(
                      (_, i) => {
                        const isHourLine = i % (60 / SLOT_MINUTES) === 0;
                        return (
                          <div
                            key={i}
                            className={cn(
                              "border-b",
                              isHourLine ? "border-border" : "border-border/30",
                            )}
                            style={{ height: (HOUR_HEIGHT * SLOT_MINUTES) / 60 }}
                          />
                        );
                      },
                    )}

                    {/* Now indicator */}
                    {isToday && nowMinutes >= 0 && nowMinutes <= totalHours * 60 && (
                      <div
                        className="pointer-events-none absolute left-0 right-0 z-10"
                        style={{ top: nowTop }}
                      >
                        <div className="h-px w-full bg-destructive" />
                        <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-destructive" />
                      </div>
                    )}

                    {/* Appointments */}
                    {list.map((a) => (
                      <AppointmentBlock
                        key={a.id}
                        a={a}
                        onUpdateStatus={onUpdateStatus}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────── Appointment block ─────────────────────────── */
function AppointmentBlock({
  a,
  onUpdateStatus,
}: {
  a: Appointment;
  onUpdateStatus: (id: string, status: Appointment["status"]) => void;
}) {
  const start = toMinutes(a.startTime) - MIN_HOUR * 60;
  const end = toMinutes(a.endTime) - MIN_HOUR * 60;
  const duration = Math.max(15, end - start);
  const top = (start / 60) * HOUR_HEIGHT;
  const height = (duration / 60) * HOUR_HEIGHT;
  const style = STATUS_STYLES[a.status] ?? STATUS_STYLES.SCHEDULED;

  const compact = height < 48;

  const [open, setOpen] = useState(false);

  return (
    <div className="absolute left-1 right-1 z-[5]" style={{ top, height }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group relative block h-full w-full overflow-hidden rounded-md border-l-2 px-2 py-1 text-left transition-colors",
          style.bg,
          style.border,
        )}
      >
        <div className="flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          {a.startTime}
          {a.tokenNumber != null && (
            <span className="ml-auto rounded bg-background/70 px-1 text-[9px] font-semibold">
              #{a.tokenNumber}
            </span>
          )}
        </div>
        <div
          className={cn("truncate font-semibold", compact ? "text-[11px]" : "text-xs")}
        >
          {a.patient.firstName} {a.patient.lastName}
        </div>
        {!compact && (
          <div className="truncate text-[10px] text-muted-foreground">
            MRN {a.patient.mrn} · {a.type?.replace("_", " ")}
          </div>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-md border bg-popover p-3 shadow-lg min-w-[240px]">
          <div className="flex items-start gap-2">
            <span className={cn("mt-1 h-2 w-2 rounded-full", style.dot)} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">
                {a.patient.firstName} {a.patient.lastName}
              </div>
              <div className="text-[11px] text-muted-foreground tabular-nums">
                MRN {a.patient.mrn} · {a.startTime}–{a.endTime}
              </div>
              {a.reason && (
                <div className="mt-1 text-[11px] text-muted-foreground italic line-clamp-2">
                  {a.reason}
                </div>
              )}
            </div>
            <button
              className="text-muted-foreground hover:text-foreground text-xs px-1"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
            >
              ✕
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {a.status === "SCHEDULED" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateStatus(a.id, "CHECKED_IN");
                }}
              >
                <UserIcon className="h-3 w-3" />
                Check-in
              </Button>
            )}
            {(a.status === "CHECKED_IN" || a.status === "SCHEDULED") && (
              <Button size="sm" className="h-7 text-xs" asChild>
                <Link
                  href={`/opd/consultations/new?patientId=${a.patient.id}&appointmentId=${a.id}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Stethoscope className="h-3 w-3" />
                  Start
                </Link>
              </Button>
            )}
            {a.status === "IN_PROGRESS" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateStatus(a.id, "COMPLETED");
                }}
              >
                Complete
              </Button>
            )}
            {a.status !== "CANCELLED" && a.status !== "COMPLETED" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateStatus(a.id, "CANCELLED");
                }}
              >
                Cancel
              </Button>
            )}
            <Button asChild size="sm" variant="ghost" className="ml-auto h-7 text-xs">
              <Link
                href={`/appointments/${a.id}`}
                onClick={(e) => e.stopPropagation()}
              >
                Open →
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── List view fallback ─────────────────────────── */
function ListView({
  appointments,
  loading,
  onUpdateStatus,
}: {
  appointments: Appointment[];
  loading: boolean;
  onUpdateStatus: (id: string, status: Appointment["status"]) => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading…
        </CardContent>
      </Card>
    );
  }
  if (appointments.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No appointments on this date.
        </CardContent>
      </Card>
    );
  }
  const sorted = [...appointments].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime),
  );
  return (
    <Card>
      <CardContent className="p-0 divide-y">
        {sorted.map((a) => {
          const style = STATUS_STYLES[a.status];
          return (
            <div
              key={a.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
            >
              <div className="w-16 tabular-nums text-sm font-semibold">{a.startTime}</div>
              <span className={cn("h-2 w-2 rounded-full", style.dot)} />
              <Link href={`/patients/${a.patient.id}`} className="flex-1 min-w-0 group">
                <div className="text-sm font-medium truncate group-hover:text-primary">
                  {a.patient.firstName} {a.patient.lastName}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  MRN {a.patient.mrn} · Dr. {a.doctor.user.name}
                </div>
              </Link>
              <span className="hidden md:inline text-[10px] rounded bg-muted px-1.5 py-0.5">
                {style.label}
              </span>
              <div className="flex gap-1">
                {a.status === "SCHEDULED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onUpdateStatus(a.id, "CHECKED_IN")}
                  >
                    Check-in
                  </Button>
                )}
                <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                  <Link href={`/appointments/${a.id}`}>Open</Link>
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
