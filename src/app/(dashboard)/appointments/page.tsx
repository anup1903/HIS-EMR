"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Calendar, List, Eye } from "lucide-react";

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateFilter) params.set("date", dateFilter);
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/appointments?${params}`)
      .then((r) => r.json())
      .then((data) => setAppointments(data.data || []))
      .finally(() => setLoading(false));
  }, [dateFilter, statusFilter]);

  return (
    <div className="space-y-6">
      <PageHeader title="Appointments" description="Manage patient appointments">
        <Button asChild><Link href="/appointments/new"><Plus className="mr-2 h-4 w-4" />Book Appointment</Link></Button>
      </PageHeader>

      <div className="flex flex-wrap gap-4">
        <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-48" />
        <select className="flex h-10 rounded-md border px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="CHECKED_IN">Checked In</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <div className="ml-auto flex gap-1">
          <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}><List className="h-4 w-4" /></Button>
          <Button variant={view === "calendar" ? "default" : "outline"} size="sm" onClick={() => setView("calendar")}><Calendar className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : appointments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No appointments found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((apt: Record<string, unknown>) => (
                  <TableRow key={apt.id as string}>
                    <TableCell className="font-medium">{apt.startTime as string} - {apt.endTime as string}</TableCell>
                    <TableCell>{(apt.patient as Record<string, string>)?.firstName} {(apt.patient as Record<string, string>)?.lastName}</TableCell>
                    <TableCell>Dr. {(apt.doctor as Record<string, Record<string, string>>)?.user?.name}</TableCell>
                    <TableCell>{(apt.department as Record<string, string>)?.name}</TableCell>
                    <TableCell>{(apt.type as string)?.replace("_", " ")}</TableCell>
                    <TableCell><StatusBadge status={apt.status as string} /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild><Link href={`/appointments/${apt.id}`}><Eye className="h-4 w-4" /></Link></Button>
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
