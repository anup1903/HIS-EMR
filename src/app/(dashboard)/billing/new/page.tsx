"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<Record<string, string>[]>([]);
  const [form, setForm] = useState({
    patientId: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    discount: 0,
    tax: 0,
    notes: "",
  });
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, unitPrice: 0, amount: 0 },
  ]);

  useEffect(() => {
    fetch("/api/patients?limit=100").then((r) => r.json()).then((data) => setPatients(data.data || []));
  }, []);

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      updated[index].amount = updated[index].quantity * updated[index].unitPrice;
      return updated;
    });
  };

  const addItem = () => setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0, amount: 0 }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const total = subtotal - form.discount + form.tax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/billing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          items: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
          })),
        }),
      });
      if (res.ok) router.push("/billing");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="New Invoice" description="Create a new billing invoice" />
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Patient</Label>
              <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.patientId} onChange={(e) => setForm((p) => ({ ...p, patientId: e.target.value }))} required>
                <option value="">Select Patient</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.mrn})</option>)}
              </select>
            </div>
            <div><Label>Invoice Date</Label><Input type="date" value={form.invoiceDate} onChange={(e) => setForm((p) => ({ ...p, invoiceDate: e.target.value }))} required /></div>
            <div><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="mr-1 h-4 w-4" />Add Item</Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground">
                <div className="col-span-5">Description</div>
                <div className="col-span-2">Qty</div>
                <div className="col-span-2">Unit Price</div>
                <div className="col-span-2">Amount</div>
                <div className="col-span-1"></div>
              </div>
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-5" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} placeholder="Item description" required />
                  <Input className="col-span-2" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, "quantity", parseInt(e.target.value) || 0)} />
                  <Input className="col-span-2" type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)} />
                  <div className="col-span-2 flex items-center font-medium">${item.amount.toFixed(2)}</div>
                  <Button type="button" variant="ghost" size="sm" className="col-span-1" onClick={() => removeItem(i)} disabled={items.length === 1}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-end space-y-2">
              <div className="flex gap-4 items-center"><span className="text-muted-foreground">Subtotal:</span><span className="font-medium w-24 text-right">${subtotal.toFixed(2)}</span></div>
              <div className="flex gap-4 items-center"><Label className="text-muted-foreground">Discount:</Label><Input type="number" min="0" step="0.01" className="w-24" value={form.discount} onChange={(e) => setForm((p) => ({ ...p, discount: parseFloat(e.target.value) || 0 }))} /></div>
              <div className="flex gap-4 items-center"><Label className="text-muted-foreground">Tax:</Label><Input type="number" min="0" step="0.01" className="w-24" value={form.tax} onChange={(e) => setForm((p) => ({ ...p, tax: parseFloat(e.target.value) || 0 }))} /></div>
              <div className="flex gap-4 items-center border-t pt-2"><span className="font-bold">Total:</span><span className="font-bold w-24 text-right">${total.toFixed(2)}</span></div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create Invoice"}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
