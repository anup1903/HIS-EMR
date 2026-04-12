"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StatsCard } from "@/components/shared/stats-card";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Receipt,
  FileText,
  Clock,
  CheckCircle,
  IndianRupee,
  Plus,
  Eye,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const invoiceStatusColor: Record<string, string> = {
  PAID: "bg-success/10 text-success",
  ISSUED: "bg-warning/10 text-warning",
  PARTIALLY_PAID: "bg-info/10 text-info",
  DRAFT: "bg-muted text-muted-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
  PENDING: "bg-warning/10 text-warning",
};

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

  const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount ?? 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount ?? 0), 0);
  const paidCount = invoices.filter((inv) => inv.status === "PAID").length;
  const pendingCount = invoices.filter((inv) => inv.status === "PENDING" || inv.status === "ISSUED").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Billing & Invoicing</h1>
            <p className="text-sm text-muted-foreground">
              Invoice management and payment tracking.
            </p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href="/billing/new">
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="Total Invoices"
          value={invoices.length}
          description="All invoices"
          icon={FileText}
          accent="primary"
        />
        <StatsCard
          title="Pending"
          value={pendingCount}
          description="Awaiting payment"
          icon={Clock}
          accent="warning"
        />
        <StatsCard
          title="Paid"
          value={paidCount}
          description="Completed payments"
          icon={CheckCircle}
          accent="success"
        />
        <StatsCard
          title="Revenue"
          value={`₹${Number(totalRevenue ?? 0).toFixed(2)}`}
          description={`Collected: ₹${Number(totalPaid ?? 0).toFixed(2)}`}
          icon={IndianRupee}
          accent="info"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING">Pending</option>
          <option value="ISSUED">Issued</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Invoice Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <MedicalEmptyState
              illustration="inbox"
              title="No invoices found"
              description="No invoices match your current filters."
              action={{ label: "Create Invoice", href: "/billing/new" }}
              className="my-6"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead className="text-[11px] uppercase tracking-wider">Invoice #</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Total</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Paid</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Balance</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Date</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id as string} className="hover:bg-secondary/30 transition-colors">
                    <TableCell className="font-mono text-xs font-medium">
                      {inv.invoiceNo as string}
                    </TableCell>
                    <TableCell className="text-sm">
                      {(inv.patient as Record<string, string>)?.firstName}{" "}
                      {(inv.patient as Record<string, string>)?.lastName}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      ₹{Number(inv.totalAmount ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      ₹{Number(inv.paidAmount ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      ₹{Number(inv.balanceAmount ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px] border-0", invoiceStatusColor[(inv.status as string)] || "bg-muted text-muted-foreground")}>
                        {(inv.status as string)?.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(inv.invoiceDate as string).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/billing/invoices/${inv.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
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
