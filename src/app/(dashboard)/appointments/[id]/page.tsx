"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AppointmentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [appointment, setAppointment] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/appointments/${id}`)
      .then((r) => r.json())
      .then((data) => setAppointment(data.data))
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status: string) => {
    await fetch(`/api/appointments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setAppointment((prev) => prev ? { ...prev, status } : null);
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!appointment) return <div className="text-center py-8">Appointment not found</div>;

  const apt = appointment as Record<string, unknown>;
  const patient = apt.patient as Record<string, string>;
  const doctor = apt.doctor as Record<string, Record<string, string>>;
  const dept = apt.department as Record<string, string>;

  return (
    <div className="space-y-6">
      <PageHeader title={`Appointment - ${apt.appointmentNo}`} description={`${new Date(apt.date as string).toLocaleDateString()}`}>
        <StatusBadge status={apt.status as string} />
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Patient Details</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p><span className="text-muted-foreground">Name:</span> {patient?.firstName} {patient?.lastName}</p>
            <p><span className="text-muted-foreground">MRN:</span> {patient?.mrn}</p>
            <p><span className="text-muted-foreground">Phone:</span> {patient?.phone}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Appointment Details</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p><span className="text-muted-foreground">Doctor:</span> Dr. {doctor?.user?.name}</p>
            <p><span className="text-muted-foreground">Department:</span> {dept?.name}</p>
            <p><span className="text-muted-foreground">Time:</span> {apt.startTime as string} - {apt.endTime as string}</p>
            <p><span className="text-muted-foreground">Type:</span> {(apt.type as string)?.replace("_", " ")}</p>
            {apt.notes ? <p><span className="text-muted-foreground">Notes:</span> {apt.notes as string}</p> : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {apt.status === "SCHEDULED" && (
            <>
              <Button onClick={() => updateStatus("CHECKED_IN")}>Check In</Button>
              <Button variant="destructive" onClick={() => updateStatus("CANCELLED")}>Cancel</Button>
            </>
          )}
          {apt.status === "CHECKED_IN" && (
            <Button onClick={() => updateStatus("IN_PROGRESS")}>Start Consultation</Button>
          )}
          {apt.status === "IN_PROGRESS" && (
            <Button onClick={() => updateStatus("COMPLETED")}>Complete</Button>
          )}
          <Button variant="outline" onClick={() => router.back()}>Back</Button>
        </CardContent>
      </Card>
    </div>
  );
}
