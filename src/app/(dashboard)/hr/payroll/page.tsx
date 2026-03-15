"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DollarSign } from "lucide-react";

export default function PayrollPage() {
  const [payrolls, setPayrolls] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });

  const loadPayrolls = () => {
    fetch("/api/hr/payroll")
      .then((r) => r.json())
      .then((data) => setPayrolls(data.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPayrolls(); }, []);

  const runPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/hr/payroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { setOpen(false); loadPayrolls(); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Payroll" description="Process salary and generate payslips">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><DollarSign className="mr-2 h-4 w-4" />Run Payroll</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Run Payroll</DialogTitle></DialogHeader>
            <form onSubmit={runPayroll} className="space-y-4">
              <div><Label>Month</Label><Input type="number" min="1" max="12" value={form.month} onChange={(e) => setForm((p) => ({ ...p, month: parseInt(e.target.value) }))} required /></div>
              <div><Label>Year</Label><Input type="number" min="2020" value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: parseInt(e.target.value) }))} required /></div>
              <Button type="submit">Generate Payroll</Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          {loading ? <p className="text-muted-foreground">Loading...</p> : payrolls.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No payroll runs found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Total Gross</TableHead>
                  <TableHead>Total Deductions</TableHead>
                  <TableHead>Total Net</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrolls.map((pr) => (
                  <TableRow key={pr.id as string}>
                    <TableCell className="font-medium">{pr.month as number}/{pr.year as number}</TableCell>
                    <TableCell>${(pr.totalGross as number)?.toLocaleString()}</TableCell>
                    <TableCell>${(pr.totalDeductions as number)?.toLocaleString()}</TableCell>
                    <TableCell className="font-bold">${(pr.totalNet as number)?.toLocaleString()}</TableCell>
                    <TableCell>{((pr.payslips as unknown[]) || []).length}</TableCell>
                    <TableCell><StatusBadge status={pr.status as string} /></TableCell>
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
