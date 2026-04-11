import { getAuthSession } from "@/lib/helpers/rbac";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DoctorDay } from "@/components/dashboard/today/doctor-day";
import { NurseDay } from "@/components/dashboard/today/nurse-day";
import { ReceptionDay } from "@/components/dashboard/today/reception-day";
import { AdminDay } from "@/components/dashboard/today/admin-day";
import { GenericDay } from "@/components/dashboard/today/generic-day";

export const metadata = { title: "My Day · HIS" };
// Dashboards are user-specific; never statically cache.
export const dynamic = "force-dynamic";

function DayFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-80" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export default async function DashboardPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const user = session.user as { id: string; name?: string | null; role?: string };
  const role = (user.role ?? "RECEPTIONIST") as Role;
  const name = user.name ?? "there";

  return (
    <Suspense fallback={<DayFallback />}>
      {role === "ADMIN" && <AdminDay name={name} />}
      {role === "DOCTOR" && <DoctorDay userId={user.id} name={name} />}
      {role === "NURSE" && <NurseDay name={name} />}
      {role === "RECEPTIONIST" && <ReceptionDay name={name} />}
      {(role === "PHARMACIST" ||
        role === "LAB_TECHNICIAN" ||
        role === "RADIOLOGIST" ||
        role === "ACCOUNTANT") && <GenericDay role={role} name={name} />}
    </Suspense>
  );
}
