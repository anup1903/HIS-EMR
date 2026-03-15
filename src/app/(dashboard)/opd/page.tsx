"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Stethoscope, Users, Clock, CheckCircle, Plus, Eye } from "lucide-react";

export default function OPDPage() {
  const [queue, setQueue] = useState<Record<string, unknown>[]>([]);
  const [consultations, setConsultations] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/opd/queue").then((r) => r.json()),
      fetch("/api/opd/consultations?limit=20").then((r) => r.json()),
    ]).then(([qData, cData]) => {
      setQueue(qData.data || []);
      setConsultations(cData.data || []);
    }).finally(() => setLoading(false));
  }, []);

  const waiting = queue.filter((q) => q.status === "WAITING").length;
  const inProgress = queue.filter((q) => q.status === "IN_CONSULTATION").length;
  const completed = queue.filter((q) => q.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      <PageHeader title="OPD - Outpatient Department" description="Manage consultations and patient queue">
        <Button asChild><Link href="/opd/consultations/new"><Plus className="mr-2 h-4 w-4" />New Consultation</Link></Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total in Queue" value={queue.length} icon={Users} />
        <StatsCard title="Waiting" value={waiting} icon={Clock} />
        <StatsCard title="In Consultation" value={inProgress} icon={Stethoscope} />
        <StatsCard title="Completed" value={completed} icon={CheckCircle} />
      </div>

      <Card>
        <CardHeader><CardTitle>Today&apos;s Queue</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Loading...</p> : queue.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No patients in queue today</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((q: Record<string, unknown>) => {
                  const con = q.consultation as Record<string, unknown> | undefined;
                  const patient = con?.patient as Record<string, string>;
                  const doctor = con?.doctor as Record<string, Record<string, string>>;
                  return (
                    <TableRow key={q.id as string}>
                      <TableCell className="font-bold">{q.tokenNumber as number}</TableCell>
                      <TableCell>{patient?.firstName} {patient?.lastName}</TableCell>
                      <TableCell>Dr. {doctor?.user?.name}</TableCell>
                      <TableCell>{(con?.department as Record<string, string>)?.name}</TableCell>
                      <TableCell><StatusBadge status={q.status as string} /></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/opd/consultations/${con?.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Consultations</CardTitle></CardHeader>
        <CardContent>
          {consultations.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No consultations found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultation #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultations.map((c: Record<string, unknown>) => (
                  <TableRow key={c.id as string}>
                    <TableCell className="font-medium">{c.consultationNo as string}</TableCell>
                    <TableCell>{(c.patient as Record<string, string>)?.firstName} {(c.patient as Record<string, string>)?.lastName}</TableCell>
                    <TableCell>Dr. {(c.doctor as Record<string, Record<string, string>>)?.user?.name}</TableCell>
                    <TableCell>{(c.diagnosis as string) || "Pending"}</TableCell>
                    <TableCell><StatusBadge status={c.status as string} /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild><Link href={`/opd/consultations/${c.id}`}><Eye className="h-4 w-4" /></Link></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
