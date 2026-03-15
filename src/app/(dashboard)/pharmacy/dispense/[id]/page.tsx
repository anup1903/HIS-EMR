"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function DispensePrescriptionPage() {
  const { id } = useParams();
  const router = useRouter();
  const [prescription, setPrescription] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispensing, setDispensing] = useState(false);

  useEffect(() => {
    fetch(`/api/pharmacy/dispense?prescriptionId=${id}`)
      .then((r) => r.json())
      .then((data) => {
        const rxList = data.data || [];
        setPrescription(rxList.find((rx: Record<string, unknown>) => rx.id === id) || rxList[0] || null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleDispense = async () => {
    setDispensing(true);
    try {
      const res = await fetch("/api/pharmacy/dispense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prescriptionId: id }),
      });
      if (res.ok) router.push("/pharmacy");
    } finally { setDispensing(false); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!prescription) return <div className="text-center py-8">Prescription not found</div>;

  const rx = prescription;
  const items = (rx.items as Record<string, unknown>[]) || [];

  return (
    <div className="space-y-6">
      <PageHeader title={`Dispense - ${rx.prescriptionNo}`} description={`Patient: ${(rx.patient as Record<string, string>)?.firstName} ${(rx.patient as Record<string, string>)?.lastName}`} />

      <Card>
        <CardHeader><CardTitle>Prescription Items</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Drug</TableHead>
                <TableHead>Dosage</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{(item.drug as Record<string, string>)?.name || item.drugName as string}</TableCell>
                  <TableCell>{item.dosage as string}</TableCell>
                  <TableCell>{item.frequency as string}</TableCell>
                  <TableCell>{item.duration as string}</TableCell>
                  <TableCell>{item.quantity as number}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button onClick={handleDispense} disabled={dispensing}>{dispensing ? "Dispensing..." : "Confirm Dispense"}</Button>
        <Button variant="outline" onClick={() => router.back()}>Back</Button>
      </div>
    </div>
  );
}
