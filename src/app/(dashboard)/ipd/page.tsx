"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BedDouble, Users, Plus, Eye, Activity } from "lucide-react";

export default function IPDPage() {
  const [admissions, setAdmissions] = useState<Record<string, unknown>[]>([]);
  const [beds, setBeds] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/ipd/admissions?status=ADMITTED").then((r) => r.json()),
      fetch("/api/ipd/beds").then((r) => r.json()),
    ]).then(([aData, bData]) => {
      setAdmissions(aData.data || []);
      setBeds(bData.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const totalBeds = beds.reduce((sum, w: Record<string, unknown>) => sum + ((w.beds as unknown[])?.length || 0), 0);
  const occupiedBeds = beds.reduce((sum, w: Record<string, unknown>) => sum + ((w.beds as Record<string, string>[])?.filter((b) => b.status === "OCCUPIED").length || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="IPD - Inpatient Department" description="Manage admissions and bed occupancy">
        <Button asChild><Link href="/ipd/admit"><Plus className="mr-2 h-4 w-4" />New Admission</Link></Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Active Admissions" value={admissions.length} icon={Users} />
        <StatsCard title="Total Beds" value={totalBeds} icon={BedDouble} />
        <StatsCard title="Occupied Beds" value={occupiedBeds} icon={Activity} />
        <StatsCard title="Available Beds" value={totalBeds - occupiedBeds} icon={BedDouble} />
      </div>

      <Card>
        <CardHeader><CardTitle>Current Admissions</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Loading...</p> : admissions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No active admissions</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admission #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Ward / Bed</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Admitted On</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admissions.map((adm: Record<string, unknown>) => (
                  <TableRow key={adm.id as string}>
                    <TableCell className="font-medium">{adm.admissionNo as string}</TableCell>
                    <TableCell>{(adm.patient as Record<string, string>)?.firstName} {(adm.patient as Record<string, string>)?.lastName}</TableCell>
                    <TableCell>{(adm.bed as Record<string, unknown> & { ward?: Record<string, string> })?.ward?.name} / {(adm.bed as Record<string, string>)?.bedNumber}</TableCell>
                    <TableCell>Dr. {(adm.doctor as Record<string, Record<string, string>>)?.user?.name}</TableCell>
                    <TableCell>{new Date(adm.admissionDate as string).toLocaleDateString()}</TableCell>
                    <TableCell><StatusBadge status={adm.status as string} /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild><Link href={`/ipd/admissions/${adm.id}`}><Eye className="h-4 w-4" /></Link></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bed Occupancy by Ward</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {beds.map((ward: Record<string, unknown>) => {
              const wardBeds = (ward.beds as Record<string, string>[]) || [];
              const occupied = wardBeds.filter((b) => b.status === "OCCUPIED").length;
              return (
                <div key={ward.id as string} className="border rounded-lg p-4">
                  <h4 className="font-medium">{ward.name as string}</h4>
                  <p className="text-sm text-muted-foreground">{occupied}/{wardBeds.length} beds occupied</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {wardBeds.map((bed) => (
                      <div key={bed.id} className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium ${bed.status === "OCCUPIED" ? "bg-red-100 text-red-700" : bed.status === "MAINTENANCE" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                        {bed.bedNumber}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
