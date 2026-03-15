"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/shared/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, CreditCard, TrendingUp, FileText } from "lucide-react";

export default function FinancialReportPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    fetch(`/api/reports/financial?from=${dateFrom}&to=${dateTo}`)
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading report...</div>;

  const invoiceStats = data?.invoices as Record<string, number> || {};
  const paymentsByMethod = (data?.paymentsByMethod as Record<string, unknown>[]) || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Financial Report" description="Revenue and collection analysis" />

      <div className="flex gap-4">
        <div><Label>From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Revenue" value={`$${(invoiceStats.totalAmount || 0).toLocaleString()}`} icon={TrendingUp} />
        <StatsCard title="Collected" value={`$${(invoiceStats.paidAmount || 0).toLocaleString()}`} icon={DollarSign} />
        <StatsCard title="Outstanding" value={`$${((invoiceStats.totalAmount || 0) - (invoiceStats.paidAmount || 0)).toLocaleString()}`} icon={CreditCard} />
        <StatsCard title="Total Invoices" value={invoiceStats.count || 0} icon={FileText} />
      </div>

      <Card>
        <CardHeader><CardTitle>Collections by Payment Method</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment Method</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentsByMethod.map((pm, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{(pm.paymentMethod as string)?.replace("_", " ")}</TableCell>
                  <TableCell>{pm._count as number}</TableCell>
                  <TableCell className="font-bold">${(pm._sum as Record<string, number>)?.amount?.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
