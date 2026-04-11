import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/helpers/rbac";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Activity,
  Pill,
  FlaskConical,
  ScanLine,
  BedDouble,
  Stethoscope,
  FileText,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PatientContextBar } from "@/components/shared/patient-context-bar";

export const dynamic = "force-dynamic";

function ageFromDob(dob: Date) {
  return Math.max(
    0,
    Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25)),
  );
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function EMRPatientPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const { patientId } = await params;

  const patient = await prisma.patient.findUnique({
    where: { id: patientId, deletedAt: null },
    include: {
      vitals: {
        orderBy: { recordedAt: "desc" },
        take: 10,
      },
      consultations: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          doctor: { include: { user: { select: { name: true } } } },
        },
      },
      admissions: {
        orderBy: { admissionDate: "desc" },
        take: 10,
        include: {
          bed: { include: { ward: { select: { name: true } } } },
          doctor: { include: { user: { select: { name: true } } } },
        },
      },
      prescriptions: {
        orderBy: { createdAt: "desc" },
        take: 15,
        include: {
          items: { include: { drug: { select: { name: true, strength: true } } } },
        },
      },
      labOrders: {
        orderBy: { createdAt: "desc" },
        take: 15,
        include: {
          items: { include: { labTest: { select: { name: true } } } },
        },
      },
      radiologyOrders: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          items: { include: { examType: { select: { name: true } } } },
        },
      },
      appointments: {
        orderBy: { date: "desc" },
        take: 10,
      },
    },
  });

  if (!patient) notFound();

  const age = ageFromDob(patient.dateOfBirth);
  const latestVital = patient.vitals[0];

  /* Build a unified chronological timeline */
  type TimelineEvent = {
    id: string;
    date: Date;
    kind: "visit" | "rx" | "lab" | "imaging" | "admit" | "vitals" | "appt";
    title: string;
    subtitle?: string;
    href?: string;
  };

  const events: TimelineEvent[] = [];

  for (const c of patient.consultations) {
    events.push({
      id: `c-${c.id}`,
      date: c.createdAt,
      kind: "visit",
      title: c.diagnosis || c.chiefComplaint || "Consultation",
      subtitle: `Dr. ${c.doctor.user.name}`,
      href: `/opd/consultations/${c.id}`,
    });
  }
  for (const rx of patient.prescriptions) {
    const names = rx.items
      .map((i) => `${i.drug.name} ${i.drug.strength ?? ""}`.trim())
      .slice(0, 3)
      .join(", ");
    events.push({
      id: `rx-${rx.id}`,
      date: rx.createdAt,
      kind: "rx",
      title: `Rx · ${rx.items.length} meds`,
      subtitle: names || rx.prescriptionNo,
    });
  }
  for (const lo of patient.labOrders) {
    events.push({
      id: `lo-${lo.id}`,
      date: lo.createdAt,
      kind: "lab",
      title: `Lab · ${lo.items.length} tests`,
      subtitle: lo.items.map((i) => i.labTest.name).slice(0, 3).join(", "),
    });
  }
  for (const ro of patient.radiologyOrders) {
    events.push({
      id: `ro-${ro.id}`,
      date: ro.createdAt,
      kind: "imaging",
      title: `Imaging · ${ro.items.length}`,
      subtitle: ro.items.map((i) => i.examType.name).slice(0, 2).join(", "),
    });
  }
  for (const ad of patient.admissions) {
    events.push({
      id: `ad-${ad.id}`,
      date: ad.admissionDate,
      kind: "admit",
      title: `Admitted · ${ad.bed.ward.name}`,
      subtitle: ad.admissionReason,
    });
  }
  for (const v of patient.vitals.slice(0, 3)) {
    events.push({
      id: `v-${v.id}`,
      date: v.recordedAt,
      kind: "vitals",
      title: "Vitals recorded",
      subtitle: [
        v.bloodPressureSystolic && v.bloodPressureDiastolic
          ? `BP ${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`
          : null,
        v.pulseRate ? `HR ${v.pulseRate}` : null,
        v.temperature ? `T ${v.temperature}°` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }

  events.sort((a, b) => b.date.getTime() - a.date.getTime());
  const timeline = events.slice(0, 30);

  const KIND_META = {
    visit: { icon: Stethoscope, tone: "text-primary bg-primary/10" },
    rx: { icon: Pill, tone: "text-info bg-info/10" },
    lab: { icon: FlaskConical, tone: "text-warning bg-warning/10" },
    imaging: { icon: ScanLine, tone: "text-warning bg-warning/10" },
    admit: { icon: BedDouble, tone: "text-success bg-success/10" },
    vitals: { icon: Activity, tone: "text-destructive bg-destructive/10" },
    appt: { icon: Calendar, tone: "text-muted-foreground bg-muted" },
  } as const;

  return (
    <div className="space-y-4">
      {/* Back + quick actions */}
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/emr">
            <ArrowLeft className="h-4 w-4" />
            All patients
          </Link>
        </Button>
        <div className="ml-auto flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/opd/rx-pad?patientId=${patient.id}`}>
              <Pill className="h-4 w-4" />
              Write Rx
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/opd/consultations/new?patientId=${patient.id}`}>
              <Plus className="h-4 w-4" />
              New consultation
            </Link>
          </Button>
        </div>
      </div>

      {/* Sticky context bar (shared) */}
      <div className="sticky top-16 z-20">
        <PatientContextBar patient={patient} flush />
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Left: Timeline rail */}
        <Card className="lg:sticky lg:top-40 lg:max-h-[calc(100vh-11rem)] lg:overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="p-0 lg:max-h-[calc(100vh-16rem)] lg:overflow-y-auto">
            {timeline.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                No events yet
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-[22px] top-0 bottom-0 w-px bg-border" />
                {timeline.map((e) => {
                  const { icon: Icon, tone } = KIND_META[e.kind];
                  const card = (
                    <div className="relative flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/40">
                      <span
                        className={cn(
                          "relative z-10 flex h-8 w-8 items-center justify-center rounded-full shrink-0 border-2 border-background",
                          tone,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-muted-foreground tabular-nums">
                          {formatDateTime(e.date)}
                        </div>
                        <div className="text-sm font-medium leading-tight truncate">
                          {e.title}
                        </div>
                        {e.subtitle && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            {e.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                  return e.href ? (
                    <Link key={e.id} href={e.href} className="block">
                      {card}
                    </Link>
                  ) : (
                    <div key={e.id}>{card}</div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Tabs */}
        <div>
          <Tabs defaultValue="summary">
            <TabsList>
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="visits">Visits ({patient.consultations.length})</TabsTrigger>
              <TabsTrigger value="rx">Rx ({patient.prescriptions.length})</TabsTrigger>
              <TabsTrigger value="labs">Labs ({patient.labOrders.length})</TabsTrigger>
              <TabsTrigger value="imaging">Imaging ({patient.radiologyOrders.length})</TabsTrigger>
              <TabsTrigger value="ipd">IPD ({patient.admissions.length})</TabsTrigger>
            </TabsList>

            {/* Summary */}
            <TabsContent value="summary" className="mt-3 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Problems & conditions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {patient.chronicConditions ? (
                      patient.chronicConditions.split(/[,;\n]/).map((c, i) =>
                        c.trim() ? (
                          <Badge key={i} variant="secondary" className="mr-1">
                            {c.trim()}
                          </Badge>
                        ) : null,
                      )
                    ) : (
                      <p className="text-xs text-muted-foreground">None recorded.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Allergies</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {patient.allergies ? (
                      patient.allergies.split(/[,;\n]/).map((a, i) =>
                        a.trim() ? (
                          <Badge key={i} variant="destructive" className="mr-1 gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {a.trim()}
                          </Badge>
                        ) : null,
                      )
                    ) : (
                      <p className="text-xs text-muted-foreground">No known allergies.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Latest vitals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {latestVital ? (
                      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm">
                        <Vital
                          label="BP"
                          value={
                            latestVital.bloodPressureSystolic &&
                            latestVital.bloodPressureDiastolic
                              ? `${latestVital.bloodPressureSystolic}/${latestVital.bloodPressureDiastolic}`
                              : "—"
                          }
                          unit="mmHg"
                        />
                        <Vital
                          label="HR"
                          value={latestVital.pulseRate?.toString() ?? "—"}
                          unit="bpm"
                        />
                        <Vital
                          label="Temp"
                          value={latestVital.temperature?.toString() ?? "—"}
                          unit="°F"
                        />
                        <Vital
                          label="SpO₂"
                          value={latestVital.oxygenSaturation?.toString() ?? "—"}
                          unit="%"
                        />
                        <Vital
                          label="RR"
                          value={latestVital.respiratoryRate?.toString() ?? "—"}
                          unit="/min"
                        />
                        <Vital
                          label="BMI"
                          value={latestVital.bmi?.toString() ?? "—"}
                          unit=""
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No vitals recorded.</p>
                    )}
                    {latestVital && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Recorded {formatDateTime(latestVital.recordedAt)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Visits */}
            <TabsContent value="visits" className="mt-3">
              <Card>
                <CardContent className="p-0 divide-y">
                  {patient.consultations.length === 0 ? (
                    <Empty text="No consultations yet" />
                  ) : (
                    patient.consultations.map((c) => (
                      <Link
                        key={c.id}
                        href={`/opd/consultations/${c.id}`}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 group"
                      >
                        <Stethoscope className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate group-hover:text-primary">
                            {c.diagnosis || c.chiefComplaint}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {formatDate(c.createdAt)} · Dr. {c.doctor.user.name}
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {c.status}
                        </Badge>
                      </Link>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Rx */}
            <TabsContent value="rx" className="mt-3">
              <Card>
                <CardContent className="p-0 divide-y">
                  {patient.prescriptions.length === 0 ? (
                    <Empty text="No prescriptions yet" />
                  ) : (
                    patient.prescriptions.map((rx) => (
                      <div key={rx.id} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Pill className="h-4 w-4 text-info shrink-0" />
                          <span className="text-sm font-medium">
                            {rx.prescriptionNo}
                          </span>
                          <span className="text-[11px] text-muted-foreground tabular-nums ml-auto">
                            {formatDate(rx.createdAt)}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {rx.status}
                          </Badge>
                        </div>
                        <ul className="mt-1 ml-6 list-disc text-[12px] text-muted-foreground space-y-0.5">
                          {rx.items.map((it) => (
                            <li key={it.id}>
                              {it.drug.name} {it.drug.strength} · {it.dosage} ·{" "}
                              {it.duration}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Labs */}
            <TabsContent value="labs" className="mt-3">
              <Card>
                <CardContent className="p-0 divide-y">
                  {patient.labOrders.length === 0 ? (
                    <Empty text="No lab orders yet" />
                  ) : (
                    patient.labOrders.map((lo) => (
                      <div key={lo.id} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FlaskConical className="h-4 w-4 text-warning shrink-0" />
                          <span className="text-sm font-medium">{lo.orderNo}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums ml-auto">
                            {formatDate(lo.createdAt)}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {lo.status}
                          </Badge>
                        </div>
                        <div className="mt-1 ml-6 text-[12px] text-muted-foreground">
                          {lo.items.map((i) => i.labTest.name).join(", ")}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Imaging */}
            <TabsContent value="imaging" className="mt-3">
              <Card>
                <CardContent className="p-0 divide-y">
                  {patient.radiologyOrders.length === 0 ? (
                    <Empty text="No imaging orders yet" />
                  ) : (
                    patient.radiologyOrders.map((ro) => (
                      <div key={ro.id} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ScanLine className="h-4 w-4 text-warning shrink-0" />
                          <span className="text-sm font-medium">{ro.orderNo}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums ml-auto">
                            {formatDate(ro.createdAt)}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {ro.status}
                          </Badge>
                        </div>
                        <div className="mt-1 ml-6 text-[12px] text-muted-foreground">
                          {ro.items.map((i) => i.examType.name).join(", ")}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* IPD */}
            <TabsContent value="ipd" className="mt-3">
              <Card>
                <CardContent className="p-0 divide-y">
                  {patient.admissions.length === 0 ? (
                    <Empty text="No admissions yet" />
                  ) : (
                    patient.admissions.map((ad) => (
                      <div key={ad.id} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <BedDouble className="h-4 w-4 text-success shrink-0" />
                          <span className="text-sm font-medium truncate">
                            {ad.admissionReason}
                          </span>
                          <span className="text-[11px] text-muted-foreground tabular-nums ml-auto">
                            {formatDate(ad.admissionDate)}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {ad.status}
                          </Badge>
                        </div>
                        <div className="mt-1 ml-6 text-[11px] text-muted-foreground truncate">
                          {ad.bed.ward.name} · Bed {ad.bed.bedNumber} · Dr.{" "}
                          {ad.doctor.user.name}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function Vital({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-semibold tabular-nums">
        {value}
        <span className="ml-1 text-[11px] font-normal text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="px-6 py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
      <FileText className="h-4 w-4" />
      {text}
    </div>
  );
}
