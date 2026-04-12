"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StatsCard } from "@/components/shared/stats-card";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Scissors,
  Calendar,
  Clock,
  CheckCircle,
  Activity,
  Eye,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const surgeryStatusColor: Record<string, string> = {
  SCHEDULED: "bg-info/10 text-info",
  PREP: "bg-warning/10 text-warning",
  IN_PROGRESS: "bg-warning/10 text-warning",
  RECOVERY: "bg-info/10 text-info",
  COMPLETED: "bg-success/10 text-success",
  CANCELLED: "bg-destructive/10 text-destructive",
};

const priorityColor: Record<string, string> = {
  EMERGENCY: "bg-destructive/10 text-destructive",
  URGENT: "bg-warning/10 text-warning",
  ROUTINE: "bg-secondary text-muted-foreground",
};

export default function SurgerySchedulePage() {
  const [surgeries, setSurgeries] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFilter) params.set("date", dateFilter);
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/surgery/schedule?${params}`)
      .then((r) => r.json())
      .then((data) => setSurgeries(data.data || []))
      .finally(() => setLoading(false));
  }, [dateFilter, statusFilter]);

  const scheduled = surgeries.filter((s) => s.status === "SCHEDULED").length;
  const inProgress = surgeries.filter((s) => s.status === "IN_PROGRESS").length;
  const completed = surgeries.filter((s) => s.status === "COMPLETED").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Scissors className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Operation Theatre</h1>
            <p className="text-sm text-muted-foreground">
              Surgery scheduling and OT management.
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/surgery/theatres">OT Rooms</Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="Total Surgeries"
          value={surgeries.length}
          description="Current results"
          icon={Activity}
          accent="primary"
        />
        <StatsCard
          title="Scheduled"
          value={scheduled}
          description="Upcoming procedures"
          icon={Calendar}
          accent="info"
        />
        <StatsCard
          title="In Progress"
          value={inProgress}
          description="Currently underway"
          icon={Clock}
          accent="warning"
        />
        <StatsCard
          title="Completed"
          value={completed}
          description="Finished procedures"
          icon={CheckCircle}
          accent="success"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-48"
        />
        <select
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="PREP">Prep</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RECOVERY">Recovery</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      {/* Surgery Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : surgeries.length === 0 ? (
            <MedicalEmptyState
              illustration="calendar"
              title="No surgeries found"
              description="No surgeries scheduled for the selected date and filters."
              className="my-6"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead className="text-[11px] uppercase tracking-wider">Surgery #</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Procedure</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">OT</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Surgeon</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Date</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Time</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Priority</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surgeries.map((surgery) => (
                  <TableRow key={surgery.id as string} className="hover:bg-secondary/30 transition-colors">
                    <TableCell className="font-mono text-xs font-medium">
                      {surgery.surgeryNo as string}
                    </TableCell>
                    <TableCell className="text-sm">
                      {(surgery.patient as Record<string, string>)?.firstName}{" "}
                      {(surgery.patient as Record<string, string>)?.lastName}
                    </TableCell>
                    <TableCell className="text-sm">{surgery.procedure as string}</TableCell>
                    <TableCell className="text-sm">
                      {(surgery.theatre as Record<string, string>)?.name || (surgery.theatreName as string) || "-"}
                    </TableCell>
                    <TableCell className="text-sm">{surgery.surgeon as string}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(surgery.date as string).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{surgery.startTime as string}</TableCell>
                    <TableCell>
                      {surgery.priority ? (
                        <Badge className={cn("text-[10px] border-0", priorityColor[(surgery.priority as string)] || "bg-secondary text-muted-foreground")}>
                          {(surgery.priority as string).replace(/_/g, " ")}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px] border-0", surgeryStatusColor[(surgery.status as string)] || "bg-muted text-muted-foreground")}>
                        {(surgery.status as string)?.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/surgery/${surgery.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
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
