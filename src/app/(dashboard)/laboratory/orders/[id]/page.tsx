"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function LabOrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Record<string, { result: string; remarks: string }>>({});

  useEffect(() => {
    fetch(`/api/laboratory/orders/${id || ""}?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        setOrder(data.data);
        const items = (data.data?.items as Record<string, unknown>[]) || [];
        const initialResults: Record<string, { result: string; remarks: string }> = {};
        items.forEach((item) => {
          initialResults[item.id as string] = {
            result: (item.result as string) || "",
            remarks: (item.remarks as string) || "",
          };
        });
        setResults(initialResults);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const submitResult = async (itemId: string) => {
    const res = await fetch(`/api/laboratory/results/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(results[itemId]),
    });
    if (res.ok) {
      // Refresh order
      const data = await fetch(`/api/laboratory/orders/${id || ""}?id=${id}`).then((r) => r.json());
      setOrder(data.data);
    }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!order) return <div className="text-center py-8">Order not found</div>;

  const items = (order.items as Record<string, unknown>[]) || [];
  const patient = order.patient as Record<string, string>;

  return (
    <div className="space-y-6">
      <PageHeader title={`Lab Order ${order.orderNo}`} description={`Patient: ${patient?.firstName} ${patient?.lastName}`}>
        <StatusBadge status={order.status as string} />
      </PageHeader>

      <Card>
        <CardHeader><CardTitle>Test Results</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test</TableHead>
                <TableHead>Normal Range</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const test = item.labTest as Record<string, string>;
                const itemId = item.id as string;
                return (
                  <TableRow key={itemId}>
                    <TableCell className="font-medium">{test?.name}</TableCell>
                    <TableCell>{test?.normalRange || "N/A"}</TableCell>
                    <TableCell>
                      {item.status === "COMPLETED" ? (
                        <span className={item.isAbnormal ? "text-red-600 font-bold" : ""}>{item.result as string}</span>
                      ) : (
                        <Input value={results[itemId]?.result || ""} onChange={(e) => setResults((p) => ({ ...p, [itemId]: { ...p[itemId], result: e.target.value } }))} placeholder="Enter result" className="w-32" />
                      )}
                    </TableCell>
                    <TableCell>
                      {item.status === "COMPLETED" ? (item.remarks as string) : (
                        <Input value={results[itemId]?.remarks || ""} onChange={(e) => setResults((p) => ({ ...p, [itemId]: { ...p[itemId], remarks: e.target.value } }))} placeholder="Remarks" className="w-32" />
                      )}
                    </TableCell>
                    <TableCell><StatusBadge status={item.status as string} /></TableCell>
                    <TableCell>
                      {item.status !== "COMPLETED" && (
                        <Button size="sm" onClick={() => submitResult(itemId)}>Submit</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
