"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Clock, Stethoscope, CheckCircle } from "lucide-react";

interface QueueItem {
  id: string;
  appointmentNo: string;
  tokenNumber: number | null;
  startTime: string;
  status: string;
  type: string;
  patient: { id: string; mrn: string; firstName: string; lastName: string };
  doctor: { id: string; specialization: string; user: { name: string } };
}

export default function OPDQueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = () => {
    fetch("/api/opd/queue")
      .then((r) => r.json())
      .then((data) => setQueue(data.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const scheduled = queue.filter((q) => q.status === "SCHEDULED").length;
  const checkedIn = queue.filter((q) => q.status === "CHECKED_IN").length;
  const inProgress = queue.filter((q) => q.status === "IN_PROGRESS").length;

  return (
    <div className="space-y-6">
      <PageHeader title="OPD Queue" description="Today's outpatient queue - auto-refreshes every 30 seconds" />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Today</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{queue.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{scheduled}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Checked In</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">{checkedIn}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{inProgress}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Patient Queue</CardTitle>
            <Button variant="outline" size="sm" onClick={fetchQueue}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : queue.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No patients in queue today</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>MRN</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((item) => (
                  <TableRow key={item.id} className={item.status === "IN_PROGRESS" ? "bg-green-50" : item.status === "CHECKED_IN" ? "bg-blue-50" : ""}>
                    <TableCell className="font-bold text-lg">{item.tokenNumber || "-"}</TableCell>
                    <TableCell>{item.startTime}</TableCell>
                    <TableCell className="font-medium">{item.patient.firstName} {item.patient.lastName}</TableCell>
                    <TableCell className="text-muted-foreground">{item.patient.mrn}</TableCell>
                    <TableCell>Dr. {item.doctor.user.name}</TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/appointments/${item.id}`}>View</Link>
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
