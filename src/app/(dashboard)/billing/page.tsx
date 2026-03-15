"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, FileText, Plus, Eye, CreditCard } from "lucide-react";

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/billing/invoices?${params}`)
      .then((r) => r.json())
      .then((data) => setInvoices(data.data || []))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.totalAmount as number || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paidAmount as number || 0), 0);
  const pending = invoices.filter((inv) => inv.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Billing & Invoices" description="Manage invoices and payments">
        <Button asChild><Link href="/billing/new"><Plus className="mr-2 h-4 w-4" />New Invoice</Link></Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Billed" value={`$${totalRevenue.toLocaleString()}`} icon={FileText} />
        <StatsCard title="Collected" value={`$${totalPaid.toLocaleString()}`} icon={DollarSign} />
        <StatsCard title="Outstanding" value={`$${(totalRevenue - totalPaid).toLocaleString()}`} icon={CreditCard} />
        <StatsCard title="Pending Invoices" value={pending} icon={FileText} />
      </div>

      <div className="flex gap-4">
        <select className="flex h-10 rounded-md border px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING">Pending</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? <p className="text-muted-foreground">Loading...</p> : invoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No invoices found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id as string}>
                    <TableCell className="font-medium">{inv.invoiceNo as string}</TableCell>
                    <TableCell>{(inv.patient as Record<string, string>)?.firstName} {(inv.patient as Record<string, string>)?.lastName}</TableCell>
                    <TableCell>{new Date(inv.invoiceDate as string).toLocaleDateString()}</TableCell>
                    <TableCell>${(inv.totalAmount as number)?.toLocaleString()}</TableCell>
                    <TableCell>${(inv.paidAmount as number)?.toLocaleString()}</TableCell>
                    <TableCell>${(inv.balanceAmount as number)?.toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={inv.status as string} /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild><Link href={`/billing/invoices/${inv.id}`}><Eye className="h-4 w-4" /></Link></Button>
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
