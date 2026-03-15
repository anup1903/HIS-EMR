"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Stethoscope, Calendar, Clock, CheckCircle, Eye } from "lucide-react";

const SURGERY_STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  PREP: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  RECOVERY: "bg-orange-100 text-orange-800",
  COMPLETED: "bg-green-100 text-green-800",
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

  const todayStr = new Date().toISOString().split("T")[0];
  const todaySurgeries = surgeries.filter(
    (s) => (s.date as string)?.startsWith(todayStr)
  );
  const scheduled = surgeries.filter((s) => s.status === "SCHEDULED").length;
  const inProgress = surgeries.filter((s) => s.status === "IN_PROGRESS").length;
  const completed = surgeries.filter((s) => s.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Surgery Schedule" description="Manage surgical procedures and schedules">
        <Button asChild>
          <Link href="/surgery/theatres">Operation Theatres</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Today's Surgeries" value={todaySurgeries.length} icon={Stethoscope} />
        <StatsCard title="Scheduled" value={scheduled} icon={Calendar} />
        <StatsCard title="In Progress" value={inProgress} icon={Clock} />
        <StatsCard title="Completed" value={completed} icon={CheckCircle} />
      </div>

      <div className="flex flex-wrap gap-4">
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-48"
        />
        <select
          className="flex h-10 rounded-md border px-3 py-2 text-sm"
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

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : surgeries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No surgeries found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Surgery #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Procedure</TableHead>
                  <TableHead>OT</TableHead>
                  <TableHead>Surgeon</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {surgeries.map((surgery) => (
                  <TableRow key={surgery.id as string}>
                    <TableCell className="font-medium">
                      {surgery.surgeryNo as string}
                    </TableCell>
                    <TableCell>
                      {(surgery.patient as Record<string, string>)?.firstName}{" "}
                      {(surgery.patient as Record<string, string>)?.lastName}
                    </TableCell>
                    <TableCell>{surgery.procedure as string}</TableCell>
                    <TableCell>
                      {(surgery.theatre as Record<string, string>)?.name || (surgery.theatreName as string) || "-"}
                    </TableCell>
                    <TableCell>{surgery.surgeon as string}</TableCell>
                    <TableCell>
                      {new Date(surgery.date as string).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{surgery.startTime as string}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={surgery.status as string}
                        colorMap={SURGERY_STATUS_COLORS}
                      />
                    </TableCell>
                    <TableCell>
                      {surgery.priority ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            surgery.priority === "EMERGENCY"
                              ? "bg-red-100 text-red-800"
                              : surgery.priority === "URGENT"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {(surgery.priority as string).replace(/_/g, " ")}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
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
