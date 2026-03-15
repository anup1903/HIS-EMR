"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConsultationDetailPage() {
  const { id } = useParams();
  const [consultation, setConsultation] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/opd/consultations/${id}`)
      .then((r) => r.json())
      .then((data) => setConsultation(data.data))
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (status: string) => {
    await fetch(`/api/opd/consultations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setConsultation((prev) => prev ? { ...prev, status } : null);
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!consultation) return <div className="text-center py-8">Consultation not found</div>;

  const c = consultation;
  const patient = c.patient as Record<string, string>;
  const vitals = (c.vitals as Record<string, unknown>[]) || [];
  const prescriptions = (c.prescriptions as Record<string, unknown>[]) || [];
  const labOrders = (c.labOrders as Record<string, unknown>[]) || [];

  return (
    <div className="space-y-6">
      <PageHeader title={`Consultation ${c.consultationNo}`} description={`Patient: ${patient?.firstName} ${patient?.lastName}`}>
        <StatusBadge status={c.status as string} />
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Doctor</CardTitle></CardHeader>
          <CardContent>Dr. {((c.doctor as Record<string, Record<string, string>>)?.user)?.name}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Department</CardTitle></CardHeader>
          <CardContent>{(c.department as Record<string, string>)?.name}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Date</CardTitle></CardHeader>
          <CardContent>{new Date(c.createdAt as string).toLocaleDateString()}</CardContent></Card>
      </div>

      <Tabs defaultValue="clinical">
        <TabsList>
          <TabsTrigger value="clinical">Clinical Notes</TabsTrigger>
          <TabsTrigger value="vitals">Vitals</TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
          <TabsTrigger value="orders">Lab Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="clinical">
          <Card><CardContent className="pt-6 space-y-4">
            <div><h4 className="text-sm font-medium text-muted-foreground">Chief Complaint</h4><p>{(c.chiefComplaint as string) || "Not recorded"}</p></div>
            <div><h4 className="text-sm font-medium text-muted-foreground">Present Illness</h4><p>{(c.presentIllness as string) || "Not recorded"}</p></div>
            <div><h4 className="text-sm font-medium text-muted-foreground">Diagnosis</h4><p>{(c.diagnosis as string) || "Pending"}</p></div>
            <div><h4 className="text-sm font-medium text-muted-foreground">Treatment</h4><p>{(c.treatment as string) || "Not recorded"}</p></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="vitals">
          <Card><CardContent className="pt-6">
            {vitals.length === 0 ? <p className="text-muted-foreground">No vitals recorded</p> : (
              <div className="grid gap-4 md:grid-cols-4">
                {vitals.map((v, i) => (
                  <div key={i} className="space-y-2">
                    {v.bloodPressureSystolic ? <p><span className="text-sm text-muted-foreground">BP:</span> {v.bloodPressureSystolic as number}/{v.bloodPressureDiastolic as number} mmHg</p> : null}
                    {v.heartRate ? <p><span className="text-sm text-muted-foreground">HR:</span> {v.heartRate as number} bpm</p> : null}
                    {v.temperature ? <p><span className="text-sm text-muted-foreground">Temp:</span> {v.temperature as number}°F</p> : null}
                    {v.oxygenSaturation ? <p><span className="text-sm text-muted-foreground">SpO2:</span> {v.oxygenSaturation as number}%</p> : null}
                    {v.weight ? <p><span className="text-sm text-muted-foreground">Weight:</span> {v.weight as number} kg</p> : null}
                    {v.height ? <p><span className="text-sm text-muted-foreground">Height:</span> {v.height as number} cm</p> : null}
                    {v.bmi ? <p><span className="text-sm text-muted-foreground">BMI:</span> {v.bmi as number}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="prescriptions">
          <Card><CardContent className="pt-6">
            {prescriptions.length === 0 ? <p className="text-muted-foreground">No prescriptions</p> : (
              <div className="space-y-3">
                {prescriptions.map((rx: Record<string, unknown>) => (
                  <div key={rx.id as string} className="border-b pb-2">
                    <p className="font-medium">{rx.prescriptionNo as string}</p>
                    <StatusBadge status={rx.status as string} />
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card><CardContent className="pt-6">
            {labOrders.length === 0 ? <p className="text-muted-foreground">No lab orders</p> : (
              <div className="space-y-3">
                {labOrders.map((lo: Record<string, unknown>) => (
                  <div key={lo.id as string} className="border-b pb-2 flex justify-between">
                    <span>{lo.orderNo as string}</span>
                    <StatusBadge status={lo.status as string} />
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardContent className="pt-6 flex gap-3">
          {c.status === "IN_PROGRESS" && <Button onClick={() => updateStatus("COMPLETED")}>Complete Consultation</Button>}
          {c.status === "WAITING" && <Button onClick={() => updateStatus("IN_PROGRESS")}>Start Consultation</Button>}
        </CardContent>
      </Card>
    </div>
  );
}
