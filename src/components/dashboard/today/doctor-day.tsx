import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Stethoscope,
  CheckCircle2,
  Pill,
  FileHeart,
  FlaskConical,
  PlusCircle,
} from "lucide-react";
import { StatsCard } from "@/components/shared/stats-card";
import { cn } from "@/lib/utils";
import { MyDayHeader } from "./my-day-header";
import {
  MedicalEmptyState,
  type EmptyIllustration,
} from "@/components/shared/medical-empty-state";

interface Props {
  userId: string;
  name: string;
}

/** Compute patient age from DOB. */
function ageFromDob(dob: Date) {
  return Math.max(
    0,
    Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25)),
  );
}

export async function DoctorDay({ userId, name }: Props) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 86400000);

  // Find doctor record for this user
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: { id: true, specialization: true, department: { select: { name: true } } },
  });

  if (!doctor) {
    return (
      <div className="space-y-4">
        <MyDayHeader name={name} role="DOCTOR" />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No doctor profile linked to this user. Ask an admin to connect your user
            account to a doctor record in <code>Settings → Users</code>.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pull today's work in parallel
  const [appointments, consultations, pendingLabOrders, pendingPrescriptions] =
    await Promise.all([
      prisma.appointment.findMany({
        where: {
          doctorId: doctor.id,
          date: { gte: startOfDay, lt: endOfDay },
        },
        include: {
          patient: {
            select: {
              id: true,
              mrn: true,
              firstName: true,
              lastName: true,
              dateOfBirth: true,
              gender: true,
              allergies: true,
            },
          },
          consultation: { select: { id: true, status: true } },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.consultation.findMany({
        where: {
          doctorId: doctor.id,
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
        include: {
          patient: {
            select: {
              id: true,
              mrn: true,
              firstName: true,
              lastName: true,
              dateOfBirth: true,
              gender: true,
              allergies: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.labOrder.count({
        where: {
          status: "PENDING",
          consultation: { doctorId: doctor.id },
        },
      }),
      prisma.prescription.count({
        where: {
          status: "PENDING",
          consultation: { doctorId: doctor.id },
        },
      }),
    ]);

  // Bucket appointments into Waiting / In Room / Done
  const waiting = appointments.filter(
    (a) => (a.status === "CHECKED_IN" || a.status === "SCHEDULED") && !a.consultation,
  );
  // "In Room" = consultations in progress for the doctor today
  const inRoom = consultations.filter((c) => c.status === "IN_PROGRESS");
  // "Done" = completed consultations today (include ones not linked to an appointment)
  const done = consultations.filter((c) => c.status === "COMPLETED");

  const total = waiting.length + inRoom.length + done.length;
  const completionPct =
    total > 0 ? Math.round((done.length / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <MyDayHeader
        name={name}
        role="DOCTOR"
        subtitle={`${doctor.specialization} · ${doctor.department.name}`}
      />

      {/* Top KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Today"
          value={total}
          icon={Stethoscope}
          description={`${completionPct}% done`}
        />
        <StatsCard
          title="Waiting"
          value={waiting.length}
          icon={Clock}
          accent="warning"
          description="Ready to be seen"
        />
        <StatsCard
          title="Pending Rx"
          value={pendingPrescriptions}
          icon={Pill}
          accent="info"
          description="At pharmacy"
        />
        <StatsCard
          title="Pending Labs"
          value={pendingLabOrders}
          icon={FlaskConical}
          accent="info"
          description="Awaiting results"
        />
      </div>

      {/* Kanban */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Column
          title="Waiting"
          tone="warning"
          count={waiting.length}
          empty="No patients waiting."
          emptyIllustration="calendar"
        >
          {waiting.map((apt) => (
            <PatientCard
              key={apt.id}
              patientId={apt.patient.id}
              name={`${apt.patient.firstName} ${apt.patient.lastName}`}
              mrn={apt.patient.mrn}
              age={ageFromDob(apt.patient.dateOfBirth)}
              gender={apt.patient.gender}
              allergies={apt.patient.allergies}
              meta={
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {apt.startTime}
                </span>
              }
              token={apt.tokenNumber ?? null}
              primaryAction={{
                label: "Start",
                href: `/opd/consultations/new?patientId=${apt.patient.id}&appointmentId=${apt.id}`,
                icon: PlusCircle,
              }}
            />
          ))}
        </Column>

        <Column
          title="In Room"
          tone="primary"
          count={inRoom.length}
          empty="No consultations in progress."
          emptyIllustration="stethoscope"
        >
          {inRoom.map((c) => (
            <PatientCard
              key={c.id}
              patientId={c.patient.id}
              name={`${c.patient.firstName} ${c.patient.lastName}`}
              mrn={c.patient.mrn}
              age={ageFromDob(c.patient.dateOfBirth)}
              gender={c.patient.gender}
              allergies={c.patient.allergies}
              meta={
                <span className="flex items-center gap-1 truncate">
                  <Stethoscope className="h-3 w-3" />
                  {c.chiefComplaint ?? "Consultation"}
                </span>
              }
              primaryAction={{
                label: "Open",
                href: `/opd/consultations/${c.id}`,
                icon: FileHeart,
              }}
              secondaryAction={{
                label: "Rx",
                href: `/opd/rx-pad?patientId=${c.patient.id}&consultationId=${c.id}`,
                icon: Pill,
              }}
            />
          ))}
        </Column>

        <Column
          title="Done"
          tone="success"
          count={done.length}
          empty="Nothing completed yet today."
          emptyIllustration="ecg"
        >
          {done.map((c) => (
            <PatientCard
              key={c.id}
              patientId={c.patient.id}
              name={`${c.patient.firstName} ${c.patient.lastName}`}
              mrn={c.patient.mrn}
              age={ageFromDob(c.patient.dateOfBirth)}
              gender={c.patient.gender}
              allergies={c.patient.allergies}
              meta={
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Completed
                </span>
              }
              primaryAction={{
                label: "Review",
                href: `/opd/consultations/${c.id}`,
                icon: FileHeart,
              }}
              muted
            />
          ))}
        </Column>
      </div>
    </div>
  );
}

/* ─────────── Column ─────────── */
function Column({
  title,
  tone,
  count,
  empty,
  emptyIllustration = "ecg",
  children,
}: {
  title: string;
  tone: "warning" | "primary" | "success";
  count: number;
  empty: string;
  emptyIllustration?: EmptyIllustration;
  children: React.ReactNode;
}) {
  const dot = {
    warning: "bg-warning",
    primary: "bg-primary",
    success: "bg-success",
  }[tone];
  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className={cn("h-2 w-2 rounded-full", dot)} />
          <span>{title}</span>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5 pt-0">
        {count === 0 ? (
          <MedicalEmptyState
            illustration={emptyIllustration}
            title={empty}
            className="bg-background/60"
          />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/* ─────────── Patient Card ─────────── */
function PatientCard({
  patientId,
  name,
  mrn,
  age,
  gender,
  allergies,
  token,
  meta,
  primaryAction,
  secondaryAction,
  muted,
}: {
  patientId: string;
  name: string;
  mrn: string;
  age: number;
  gender: string;
  allergies?: string | null;
  token?: number | null;
  meta?: React.ReactNode;
  primaryAction: { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
  secondaryAction?: { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
  muted?: boolean;
}) {
  const Pri = primaryAction.icon;
  const Sec = secondaryAction?.icon;
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 space-y-2 transition-shadow hover:shadow-md",
        muted && "opacity-75",
      )}
    >
      <div className="flex items-start gap-2">
        <Link
          href={`/patients/${patientId}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs shrink-0"
        >
          {name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")}
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/patients/${patientId}`}
            className="block text-sm font-semibold truncate hover:text-primary transition-colors"
          >
            {name}
          </Link>
          <div className="text-[11px] text-muted-foreground tabular-nums truncate">
            MRN {mrn} · {age}
            {gender?.charAt(0)}
          </div>
        </div>
        {token != null && (
          <Badge variant="secondary" className="shrink-0 tabular-nums text-[10px]">
            #{token}
          </Badge>
        )}
      </div>
      {allergies && (
        <div className="text-[10px] leading-tight bg-destructive/5 text-destructive border border-destructive/20 rounded px-1.5 py-1 truncate">
          ⚠ {allergies}
        </div>
      )}
      {meta && <div className="text-[11px] text-muted-foreground truncate">{meta}</div>}
      <div className="flex gap-1.5 pt-1">
        <Button asChild size="sm" className="h-7 flex-1 text-xs">
          <Link href={primaryAction.href}>
            <Pri className="h-3 w-3" />
            {primaryAction.label}
          </Link>
        </Button>
        {secondaryAction && Sec && (
          <Button asChild size="sm" variant="outline" className="h-7 text-xs">
            <Link href={secondaryAction.href}>
              <Sec className="h-3 w-3" />
              {secondaryAction.label}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
