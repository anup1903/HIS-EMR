import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/shared/stats-card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Calendar,
  BedDouble,
  DollarSign,
  Receipt,
  Pill,
  FlaskConical,
  Activity,
  AlertTriangle,
  ArrowRight,
  Package,
} from "lucide-react";
import { MyDayHeader } from "./my-day-header";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { cn } from "@/lib/utils";

interface Props {
  name: string;
}

export async function AdminDay({ name }: Props) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 86400000);

  const [
    totalPatients,
    todayAppointments,
    activeAdmissions,
    totalBeds,
    occupiedBeds,
    pendingInvoices,
    pendingLabOrders,
    pendingPrescriptions,
    todayRevenue,
    lowStockDrugs,
    upcomingAppointments,
  ] = await Promise.all([
    prisma.patient.count({ where: { deletedAt: null } }),
    prisma.appointment.count({ where: { date: { gte: startOfDay, lt: endOfDay } } }),
    prisma.admission.count({ where: { status: "ADMITTED" } }),
    prisma.bed.count(),
    prisma.bed.count({ where: { status: "OCCUPIED" } }),
    prisma.invoice.count({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] } } }),
    prisma.labOrder.count({ where: { status: "PENDING" } }),
    prisma.prescription.count({ where: { status: "PENDING" } }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: startOfDay, lt: endOfDay } },
      _sum: { amount: true },
    }),
    prisma.drug.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        stockQuantity: true,
        reorderLevel: true,
      },
      take: 100,
    }),
    prisma.appointment.findMany({
      where: { date: { gte: startOfDay, lt: endOfDay } },
      include: {
        patient: { select: { firstName: true, lastName: true, mrn: true, id: true } },
        doctor: { select: { user: { select: { name: true } } } },
      },
      take: 6,
      orderBy: { startTime: "asc" },
    }),
  ]);

  // Filter low-stock in memory since Prisma can't compare two columns directly.
  const lowStock = lowStockDrugs.filter((d) => d.stockQuantity <= d.reorderLevel);
  const outOfStock = lowStock.filter((d) => d.stockQuantity === 0);

  const revenueToday = Number(todayRevenue._sum.amount || 0);
  const occupancyPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  return (
    <div className="space-y-6">
      <MyDayHeader
        name={name}
        role="ADMIN"
        subtitle="Hospital-wide overview · drill into any tile"
      />

      {/* Top row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Patients"
          value={totalPatients}
          icon={Users}
          description="Registered patients"
          accent="primary"
        />
        <StatsCard
          title="Today's Appts"
          value={todayAppointments}
          icon={Calendar}
          description="Scheduled for today"
          accent="info"
        />
        <StatsCard
          title="Active Admissions"
          value={activeAdmissions}
          icon={BedDouble}
          description={`${occupiedBeds}/${totalBeds} beds · ${occupancyPct}%`}
        />
        <StatsCard
          title="Today's Revenue"
          value={`₹${revenueToday.toLocaleString()}`}
          icon={DollarSign}
          description="Collected today"
          accent="success"
        />
      </div>

      {/* Second row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Pending Invoices"
          value={pendingInvoices}
          icon={Receipt}
          accent="warning"
          description="Awaiting payment"
        />
        <StatsCard
          title="Pending Labs"
          value={pendingLabOrders}
          icon={FlaskConical}
          accent="info"
          description="Awaiting results"
        />
        <StatsCard
          title="Pending Rx"
          value={pendingPrescriptions}
          icon={Pill}
          accent="info"
          description="At pharmacy"
        />
        <StatsCard
          title="Bed Occupancy"
          value={`${occupancyPct}%`}
          icon={Activity}
          description={`${occupiedBeds}/${totalBeds} beds`}
          accent={occupancyPct >= 90 ? "destructive" : occupancyPct >= 75 ? "warning" : "primary"}
        />
      </div>

      {/* Needs attention + today's schedule */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Today&apos;s schedule</CardTitle>
            <Link href="/appointments" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingAppointments.length === 0 ? (
              <div className="p-4">
                <MedicalEmptyState
                  illustration="calendar"
                  title="No appointments today"
                  action={{ label: "View schedule", href: "/appointments" }}
                />
              </div>
            ) : (
              <div className="divide-y">
                {upcomingAppointments.map((a) => (
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
                      <div className="text-[11px] text-muted-foreground truncate">
                        MRN {a.patient.mrn} · Dr. {a.doctor.user.name}
                      </div>
                    </Link>
                    <Badge className="text-[10px] bg-muted text-muted-foreground border-0">
                      {a.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <AttentionRow
              icon={Package}
              label="Drugs out of stock"
              value={outOfStock.length}
              href="/pharmacy"
              tone={outOfStock.length > 0 ? "destructive" : "muted"}
            />
            <AttentionRow
              icon={Package}
              label="Drugs low stock"
              value={lowStock.length - outOfStock.length}
              href="/pharmacy"
              tone={lowStock.length > 0 ? "warning" : "muted"}
            />
            <AttentionRow
              icon={Receipt}
              label="Unpaid invoices"
              value={pendingInvoices}
              href="/billing"
              tone={pendingInvoices > 0 ? "warning" : "muted"}
            />
            <AttentionRow
              icon={FlaskConical}
              label="Lab orders pending"
              value={pendingLabOrders}
              href="/laboratory"
              tone={pendingLabOrders > 0 ? "info" : "muted"}
            />
            <AttentionRow
              icon={Pill}
              label="Prescriptions pending"
              value={pendingPrescriptions}
              href="/pharmacy"
              tone={pendingPrescriptions > 0 ? "info" : "muted"}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AttentionRow({
  icon: Icon,
  label,
  value,
  href,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  href: string;
  tone: "destructive" | "warning" | "info" | "muted";
}) {
  const toneMap = {
    destructive: "bg-destructive/10 text-destructive",
    warning: "bg-warning/10 text-warning",
    info: "bg-info/10 text-info",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-md p-2 hover:bg-muted/60 transition-colors"
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md",
          toneMap[tone],
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-sm flex-1 truncate">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );
}
