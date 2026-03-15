"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function RadiologyOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [findings, setFindings] = useState("");
  const [impression, setImpression] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/radiology/results/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setOrder(data.data);
        if (data.data) {
          setFindings((data.data.findings as string) || "");
          setImpression((data.data.impression as string) || "");
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const submitReport = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/radiology/results/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findings, impression, status: "COMPLETED" }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrder(data.data);
      }
    } finally { setSaving(false); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!order) return <div className="text-center py-8">Order not found</div>;

  const patient = order.patient as Record<string, string>;

  return (
    <div className="space-y-6">
      <PageHeader title={`Radiology Order ${order.orderNo}`} description={`Patient: ${patient?.firstName} ${patient?.lastName}`}>
        <StatusBadge status={order.status as string} />
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Modality</CardTitle></CardHeader>
          <CardContent>{(order.modality as Record<string, string>)?.name}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Exam Type</CardTitle></CardHeader>
          <CardContent>{order.examType as string}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ordered By</CardTitle></CardHeader>
          <CardContent>Dr. {(order.doctor as Record<string, Record<string, string>>)?.user?.name}</CardContent></Card>
      </div>

      {order.clinicalHistory ? (
        <Card>
          <CardHeader><CardTitle>Clinical History</CardTitle></CardHeader>
          <CardContent><p>{order.clinicalHistory as string}</p></CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Radiology Report</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {order.status === "COMPLETED" ? (
            <>
              <div><h4 className="text-sm font-medium text-muted-foreground">Findings</h4><p>{findings || "N/A"}</p></div>
              <div><h4 className="text-sm font-medium text-muted-foreground">Impression</h4><p>{impression || "N/A"}</p></div>
            </>
          ) : (
            <>
              <div><Label>Findings</Label><Textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={5} placeholder="Describe findings..." /></div>
              <div><Label>Impression</Label><Textarea value={impression} onChange={(e) => setImpression(e.target.value)} rows={3} placeholder="Overall impression..." /></div>
              <Button onClick={submitReport} disabled={saving}>{saving ? "Submitting..." : "Submit Report"}</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
