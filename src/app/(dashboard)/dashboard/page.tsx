import { getAuthSession } from "@/lib/helpers/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StatsCard } from "@/components/shared/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, BedDouble, Receipt, Pill, FlaskConical, Activity, DollarSign } from "lucide-react";
import { RoleBasedQuickActions } from "@/components/dashboard/role-dashboards";

export default async function DashboardPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);

  const [totalPatients, todayAppointments, activeAdmissions, pendingInvoices, pendingLabOrders, pendingPrescriptions, todayRevenue, totalBeds] = await Promise.all([
    prisma.patient.count({ where: { deletedAt: null } }),
    prisma.appointment.count({ where: { date: { gte: today, lt: tomorrow } } }),
    prisma.admission.count({ where: { status: "ADMITTED" } }),
    prisma.invoice.count({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] } } }),
    prisma.labOrder.count({ where: { status: "PENDING" } }),
    prisma.prescription.count({ where: { status: "PENDING" } }),
    prisma.payment.aggregate({ where: { paidAt: { gte: today, lt: tomorrow } }, _sum: { amount: true } }),
    prisma.bed.count(),
  ]);

  const occupiedBeds = await prisma.bed.count({ where: { status: "OCCUPIED" } });
  const revenueToday = Number(todayRevenue._sum.amount || 0);

  const recentAppointments = await prisma.appointment.findMany({
    where: { date: { gte: today, lt: tomorrow } },
    include: { patient: { select: { firstName: true, lastName: true, mrn: true } }, doctor: { select: { user: { select: { name: true } } } } },
    take: 5,
    orderBy: { startTime: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {session.user.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Total Patients" value={totalPatients} icon={Users} description="Registered patients" />
        <StatsCard title="Today's Appointments" value={todayAppointments} icon={Calendar} description="Scheduled for today" />
        <StatsCard title="Active Admissions" value={activeAdmissions} icon={BedDouble} description={`${occupiedBeds}/${totalBeds} beds occupied`} />
        <StatsCard title="Today's Revenue" value={`$${revenueToday.toLocaleString()}`} icon={DollarSign} description="Collected today" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Pending Invoices" value={pendingInvoices} icon={Receipt} description="Awaiting payment" />
        <StatsCard title="Pending Lab Orders" value={pendingLabOrders} icon={FlaskConical} description="Awaiting results" />
        <StatsCard title="Pending Prescriptions" value={pendingPrescriptions} icon={Pill} description="Awaiting dispensing" />
        <StatsCard title="Bed Occupancy" value={totalBeds > 0 ? `${Math.round((occupiedBeds / totalBeds) * 100)}%` : "N/A"} icon={Activity} description={`${occupiedBeds} of ${totalBeds} beds`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {recentAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments scheduled for today</p>
            ) : (
              <div className="space-y-3">
                {recentAppointments.map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{apt.patient.firstName} {apt.patient.lastName}</p>
                      <p className="text-xs text-muted-foreground">MRN: {apt.patient.mrn} | Dr. {apt.doctor.user.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{apt.startTime}</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${apt.status === "COMPLETED" ? "bg-green-100 text-green-800" : apt.status === "CANCELLED" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}`}>
                        {apt.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <RoleBasedQuickActions role={session.user.role} />
      </div>
    </div>
  );
}
