"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Stethoscope, Users, Clock, CheckCircle, Plus, Eye, UserCheck } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  IN_CONSULTATION: "bg-info/10 text-info",
  IN_PROGRESS: "bg-info/10 text-info",
  WAITING: "bg-warning/10 text-warning",
  COMPLETED: "bg-success/10 text-success",
  CANCELLED: "bg-destructive/10 text-destructive",
};

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
  const walkIns = queue.filter((q) => {
    const con = q.consultation as Record<string, unknown> | undefined;
    return con?.consultationType === "WALK_IN";
  }).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Stethoscope className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Outpatient Department</h1>
            <p className="text-sm text-muted-foreground">Consultation queue and management.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/opd/consultations/new"><Plus className="mr-2 h-4 w-4" />New Consultation</Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Queue Count" value={queue.length} icon={Users} accent="primary" />
        <StatsCard title="In Progress" value={inProgress} icon={Stethoscope} accent="info" />
        <StatsCard title="Completed Today" value={completed} icon={CheckCircle} accent="success" />
        <StatsCard title="Walk-ins" value={walkIns} icon={UserCheck} accent="warning" />
      </div>

      {/* Today's Queue */}
      <Card>
        <CardHeader><CardTitle>Today&apos;s Queue</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : queue.length === 0 ? (
            <MedicalEmptyState
              illustration="stethoscope"
              title="No patients in queue"
              description="The outpatient queue is empty. New consultations will appear here."
              action={{ label: "New Consultation", href: "/opd/consultations/new" }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Doctor</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Time</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((q: Record<string, unknown>) => {
                  const con = q.consultation as Record<string, unknown> | undefined;
                  const patient = con?.patient as Record<string, string> | undefined;
                  const doctor = con?.doctor as Record<string, Record<string, string>> | undefined;
                  const status = q.status as string;
                  const consultationType = (con?.consultationType as string) || "GENERAL";
                  const createdAt = q.createdAt ? new Date(q.createdAt as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";

                  return (
                    <TableRow key={q.id as string} className="hover:bg-secondary/30 transition-colors">
                      <TableCell>
                        <div>
                          <span className="font-medium">{patient?.firstName} {patient?.lastName}</span>
                          {patient?.dateOfBirth && (
                            <p className="text-xs text-muted-foreground">
                              Age {Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 31557600000)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">Dr. {doctor?.user?.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {consultationType.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs font-medium", STATUS_STYLES[status] || "bg-secondary text-secondary-foreground")}>
                          {status?.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{createdAt}</TableCell>
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

      {/* Recent Consultations */}
      <Card>
        <CardHeader><CardTitle>Recent Consultations</CardTitle></CardHeader>
        <CardContent>
          {consultations.length === 0 ? (
            <MedicalEmptyState
              illustration="ecg"
              title="No consultations found"
              description="Recent consultation records will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Doctor</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Time</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultations.map((c: Record<string, unknown>) => {
                  const patient = c.patient as Record<string, string> | undefined;
                  const doctor = c.doctor as Record<string, Record<string, string>> | undefined;
                  const status = c.status as string;
                  const consultationType = (c.consultationType as string) || "GENERAL";
                  const createdAt = c.createdAt ? new Date(c.createdAt as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";

                  return (
                    <TableRow key={c.id as string} className="hover:bg-secondary/30 transition-colors">
                      <TableCell>
                        <div>
                          <span className="font-medium">{patient?.firstName} {patient?.lastName}</span>
                          {patient?.dateOfBirth && (
                            <p className="text-xs text-muted-foreground">
                              Age {Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 31557600000)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">Dr. {doctor?.user?.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {consultationType.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-xs font-medium", STATUS_STYLES[status] || "bg-secondary text-secondary-foreground")}>
                          {status?.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{createdAt}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/opd/consultations/${c.id}`}><Eye className="h-4 w-4" /></Link>
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
    </div>
  );
}
