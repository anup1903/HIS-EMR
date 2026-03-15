"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/shared/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, UserCheck, Activity } from "lucide-react";

export default function PatientStatisticsPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/patient-statistics")
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-muted-foreground">Loading statistics...</div>;

  const stats = data || {};
  const genderDist = (stats.genderDistribution as Record<string, unknown>[]) || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Patient Statistics" description="Patient demographics and registration trends" />

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Patients" value={stats.totalPatients as number || 0} icon={Users} />
        <StatsCard title="New This Month" value={stats.newThisMonth as number || 0} icon={UserPlus} />
        <StatsCard title="Active Patients" value={stats.activePatients as number || 0} icon={UserCheck} />
        <StatsCard title="Appointments Today" value={stats.appointmentsToday as number || 0} icon={Activity} />
      </div>

      <Card>
        <CardHeader><CardTitle>Gender Distribution</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {genderDist.map((g, i) => (
              <div key={i} className="text-center p-4 border rounded-lg">
                <p className="text-2xl font-bold">{g._count as number}</p>
                <p className="text-sm text-muted-foreground">{g.gender as string}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Age Distribution</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            {[
              { label: "0-18", range: "Pediatric" },
              { label: "19-30", range: "Young Adult" },
              { label: "31-45", range: "Adult" },
              { label: "46-60", range: "Middle Aged" },
              { label: "60+", range: "Senior" },
            ].map((group) => (
              <div key={group.label} className="text-center p-4 border rounded-lg">
                <p className="text-lg font-bold">{group.label}</p>
                <p className="text-sm text-muted-foreground">{group.range}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
