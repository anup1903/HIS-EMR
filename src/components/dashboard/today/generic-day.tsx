import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import {
  Pill,
  FlaskConical,
  ScanLine,
  Receipt,
  ArrowRight,
  Package,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { MyDayHeader } from "./my-day-header";

interface Props {
  role: Exclude<Role, "ADMIN" | "DOCTOR" | "NURSE" | "RECEPTIONIST">;
  name: string;
}

/** Small "worklist" landing for back-office specialists. */
export async function GenericDay({ role, name }: Props) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 86400000);

  if (role === "PHARMACIST") {
    const [pendingRx, dispensedToday, lowStockDrugs, outOfStockDrugs] = await Promise.all([
      prisma.prescription.count({ where: { status: "PENDING" } }),
      prisma.dispensing.count({
        where: { dispensedAt: { gte: startOfDay, lt: endOfDay } },
      }),
      prisma.drug.findMany({
        where: { isActive: true },
        select: { id: true, name: true, stockQuantity: true, reorderLevel: true },
        take: 200,
      }),
      prisma.drug.count({ where: { isActive: true, stockQuantity: 0 } }),
    ]);
    const lowStock = lowStockDrugs.filter(
      (d) => d.stockQuantity > 0 && d.stockQuantity <= d.reorderLevel,
    );
    return (
      <RoleLayout
        name={name}
        role="PHARMACIST"
        subtitle="Dispense queue and stock monitor"
        stats={[
          { title: "Pending Rx", value: pendingRx, icon: Pill, accent: "warning" },
          { title: "Dispensed today", value: dispensedToday, icon: Pill, accent: "success" },
          { title: "Out of stock", value: outOfStockDrugs, icon: Package, accent: "destructive" },
          { title: "Low stock", value: lowStock.length, icon: Package, accent: "warning" },
        ]}
        primaryHref="/pharmacy/dispense"
        primaryLabel="Open dispense queue"
        secondaryHref="/pharmacy"
        secondaryLabel="Manage drugs"
      />
    );
  }

  if (role === "LAB_TECHNICIAN") {
    const [pendingOrders, inProgress, completedToday] = await Promise.all([
      prisma.labOrder.count({ where: { status: "PENDING" } }),
      prisma.labOrder.count({ where: { status: "IN_PROGRESS" } }),
      prisma.labOrder.count({
        where: {
          status: "COMPLETED",
          updatedAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
    ]);
    return (
      <RoleLayout
        name={name}
        role="LAB_TECHNICIAN"
        subtitle="Lab worklist — sample acceptance to result release"
        stats={[
          { title: "Pending", value: pendingOrders, icon: FlaskConical, accent: "warning" },
          { title: "In progress", value: inProgress, icon: FlaskConical, accent: "info" },
          { title: "Completed today", value: completedToday, icon: FlaskConical, accent: "success" },
          { title: "Backlog", value: pendingOrders + inProgress, icon: FlaskConical },
        ]}
        primaryHref="/laboratory"
        primaryLabel="Open worklist"
      />
    );
  }

  if (role === "RADIOLOGIST") {
    const [pending, inProgress, completedToday] = await Promise.all([
      prisma.radiologyOrder.count({ where: { status: "PENDING" } }),
      prisma.radiologyOrder.count({ where: { status: "IN_PROGRESS" } }),
      prisma.radiologyOrder.count({
        where: {
          status: "COMPLETED",
          updatedAt: { gte: startOfDay, lt: endOfDay },
        },
      }),
    ]);
    return (
      <RoleLayout
        name={name}
        role="RADIOLOGIST"
        subtitle="Imaging worklist and reporting"
        stats={[
          { title: "Pending", value: pending, icon: ScanLine, accent: "warning" },
          { title: "In progress", value: inProgress, icon: ScanLine, accent: "info" },
          { title: "Reported today", value: completedToday, icon: ScanLine, accent: "success" },
          { title: "Backlog", value: pending + inProgress, icon: ScanLine },
        ]}
        primaryHref="/radiology"
        primaryLabel="Open worklist"
      />
    );
  }

  if (role === "ACCOUNTANT") {
    const [todayRevenue, pendingInvoices, paidToday, claimsOpen] = await Promise.all([
      prisma.payment.aggregate({
        where: { paidAt: { gte: startOfDay, lt: endOfDay } },
        _sum: { amount: true },
      }),
      prisma.invoice.count({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] } } }),
      prisma.payment.count({ where: { paidAt: { gte: startOfDay, lt: endOfDay } } }),
      prisma.insuranceClaim.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    ]);
    const revenue = Number(todayRevenue._sum.amount || 0);
    return (
      <RoleLayout
        name={name}
        role="ACCOUNTANT"
        subtitle="Finance and insurance dashboard"
        stats={[
          {
            title: "Revenue today",
            value: `₹${revenue.toLocaleString()}`,
            icon: Receipt,
            accent: "success",
          },
          { title: "Payments today", value: paidToday, icon: Receipt, accent: "primary" },
          { title: "Unpaid invoices", value: pendingInvoices, icon: Receipt, accent: "warning" },
          { title: "Open claims", value: claimsOpen, icon: Receipt, accent: "info" },
        ]}
        primaryHref="/billing"
        primaryLabel="Open billing"
        secondaryHref="/insurance"
        secondaryLabel="Claims"
      />
    );
  }

  // Unknown role fallback
  return (
    <div className="space-y-6">
      <MyDayHeader name={name} role={role} />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No dashboard configured for this role yet.
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────── Shared layout for generic role dashboards ─────────── */
function RoleLayout({
  name,
  role,
  subtitle,
  stats,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  name: string;
  role: string;
  subtitle: string;
  stats: Array<{
    title: string;
    value: string | number;
    icon: LucideIcon;
    accent?: "primary" | "success" | "warning" | "info" | "destructive";
  }>;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="space-y-6">
      <MyDayHeader name={name} role={role} subtitle={subtitle} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatsCard
            key={s.title}
            title={s.title}
            value={s.value}
            icon={s.icon}
            accent={s.accent}
          />
        ))}
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Get to work</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={primaryHref}>
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          {secondaryHref && secondaryLabel && (
            <Button asChild variant="outline">
              <Link href={secondaryHref}>{secondaryLabel}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
