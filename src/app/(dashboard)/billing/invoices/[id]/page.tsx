"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paying, setPaying] = useState(false);

  const loadInvoice = () => {
    fetch(`/api/billing/invoices/${id}`)
      .then((r) => r.json())
      .then((data) => setInvoice(data.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadInvoice(); }, [id]);

  const recordPayment = async () => {
    if (!paymentAmount) return;
    setPaying(true);
    try {
      const res = await fetch("/api/billing/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: id, amount: parseFloat(paymentAmount), paymentMethod }),
      });
      if (res.ok) { setPaymentAmount(""); loadInvoice(); }
    } finally { setPaying(false); }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!invoice) return <div className="text-center py-8">Invoice not found</div>;

  const inv = invoice;
  const patient = inv.patient as Record<string, string>;
  const items = (inv.items as Record<string, unknown>[]) || [];
  const payments = (inv.payments as Record<string, unknown>[]) || [];

  return (
    <div className="space-y-6">
      <PageHeader title={`Invoice ${inv.invoiceNo}`} description={`Patient: ${patient?.firstName} ${patient?.lastName}`}>
        <StatusBadge status={inv.status as string} />
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total</CardTitle></CardHeader><CardContent className="text-xl font-bold">${Number(inv.totalAmount ?? 0).toFixed(2)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Paid</CardTitle></CardHeader><CardContent className="text-xl font-bold text-green-600">${Number(inv.paidAmount ?? 0).toFixed(2)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Balance</CardTitle></CardHeader><CardContent className="text-xl font-bold text-red-600">${Number(inv.balanceAmount ?? 0).toFixed(2)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Date</CardTitle></CardHeader><CardContent>{new Date(inv.invoiceDate as string).toLocaleDateString()}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>{item.description as string}</TableCell>
                  <TableCell>{item.quantity as number}</TableCell>
                  <TableCell>${Number(item.unitPrice ?? 0).toFixed(2)}</TableCell>
                  <TableCell>${Number(item.amount ?? 0).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex flex-col items-end space-y-1 text-sm">
            <div>Subtotal: ${Number(inv.subtotalAmount ?? 0).toFixed(2)}</div>
            {Number(inv.discount ?? 0) > 0 ? <div>Discount: -${Number(inv.discount ?? 0).toFixed(2)}</div> : null}
            {Number(inv.tax ?? 0) > 0 ? <div>Tax: +${Number(inv.tax ?? 0).toFixed(2)}</div> : null}
            <div className="font-bold text-base">Total: ${Number(inv.totalAmount ?? 0).toFixed(2)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? <p className="text-muted-foreground">No payments recorded</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Payment #</TableHead><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.map((pay) => (
                  <TableRow key={pay.id as string}>
                    <TableCell>{pay.paymentNo as string}</TableCell>
                    <TableCell>{new Date(pay.paymentDate as string).toLocaleDateString()}</TableCell>
                    <TableCell>{(pay.paymentMethod as string)?.replace("_", " ")}</TableCell>
                    <TableCell className="font-medium">${Number(pay.amount ?? 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
        <Card>
          <CardHeader><CardTitle>Record Payment</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-4 items-end">
            <div><Label>Amount</Label><Input type="number" min="0" step="0.01" max={inv.balanceAmount as number} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00" /></div>
            <div><Label>Method</Label>
              <select className="flex h-10 rounded-md border px-3 py-2 text-sm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="CASH">Cash</option><option value="CARD">Card</option><option value="BANK_TRANSFER">Bank Transfer</option><option value="INSURANCE">Insurance</option><option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <Button onClick={recordPayment} disabled={paying}>{paying ? "Processing..." : "Record Payment"}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
