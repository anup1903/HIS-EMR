"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Activity, ClipboardList, AlertTriangle } from "lucide-react";

interface Admission {
  id: string;
  admissionNo: string;
  admissionDate: string;
  status: string;
  patient: { firstName: string; lastName: string; mrn: string };
  doctor: { user: { name: string } };
  ward: { name: string };
  bed: { bedNumber: string };
  vitals?: { id: string; recordedAt: string; temperature: number; bloodPressureSystolic: number; bloodPressureDiastolic: number; pulseRate: number; oxygenSaturation: number }[];
  doctorOrders?: { id: string; orderType: string; description: string; status: string; priority: string }[];
}

export default function NursingStationPage() {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ipd/admissions?status=ADMITTED")
      .then((r) => r.json())
      .then((data) => setAdmissions(data.data || []))
      .finally(() => setLoading(false));
  }, []);

  const pendingOrders = admissions.reduce((sum, a) => sum + ((a.doctorOrders || []).filter((o) => o.status === "PENDING").length), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Nursing Station" description="Monitor patients, vitals, and execute doctor orders" />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Patients</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{admissions.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{pendingOrders}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">0</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="patients">
        <TabsList>
          <TabsTrigger value="patients">Patient List</TabsTrigger>
          <TabsTrigger value="orders">Pending Orders ({pendingOrders})</TabsTrigger>
        </TabsList>

        <TabsContent value="patients">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : admissions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No active admissions</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bed</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>MRN</TableHead>
                      <TableHead>Ward</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Admitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admissions.map((adm) => (
                      <TableRow key={adm.id}>
                        <TableCell className="font-bold">{adm.bed?.bedNumber}</TableCell>
                        <TableCell>{adm.patient?.firstName} {adm.patient?.lastName}</TableCell>
                        <TableCell className="text-muted-foreground">{adm.patient?.mrn}</TableCell>
                        <TableCell>{adm.ward?.name}</TableCell>
                        <TableCell>Dr. {adm.doctor?.user?.name}</TableCell>
                        <TableCell>{new Date(adm.admissionDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/ipd/admissions/${adm.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardContent className="pt-6">
              {admissions.flatMap((a) => (a.doctorOrders || []).filter((o) => o.status === "PENDING").map((o) => ({ ...o, patient: a.patient, bed: a.bed }))).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No pending orders</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bed</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Order Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {admissions.flatMap((a) =>
                      (a.doctorOrders || [])
                        .filter((o) => o.status === "PENDING")
                        .map((o) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-bold">{a.bed?.bedNumber}</TableCell>
                            <TableCell>{a.patient?.firstName} {a.patient?.lastName}</TableCell>
                            <TableCell>{o.orderType}</TableCell>
                            <TableCell>{o.description}</TableCell>
                            <TableCell><StatusBadge status={o.priority} /></TableCell>
                            <TableCell><StatusBadge status={o.status} /></TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
