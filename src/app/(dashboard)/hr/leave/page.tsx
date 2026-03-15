"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export default function LeavePage() {
  const [leaves, setLeaves] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leaveType: "ANNUAL", startDate: "", endDate: "", reason: "" });

  const loadLeaves = () => {
    fetch("/api/hr/leave")
      .then((r) => r.json())
      .then((data) => setLeaves(data.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadLeaves(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/hr/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { setOpen(false); loadLeaves(); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Leave Management" description="Request and manage leave">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Request Leave</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Leave Request</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Leave Type</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.leaveType} onChange={(e) => setForm((p) => ({ ...p, leaveType: e.target.value }))}>
                  <option value="ANNUAL">Annual</option><option value="SICK">Sick</option><option value="CASUAL">Casual</option><option value="MATERNITY">Maternity</option><option value="UNPAID">Unpaid</option>
                </select>
              </div>
              <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} required /></div>
              <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} required /></div>
              <div><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))} required /></div>
              <Button type="submit">Submit Request</Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          {loading ? <p className="text-muted-foreground">Loading...</p> : leaves.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No leave requests</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves.map((leave) => (
                  <TableRow key={leave.id as string}>
                    <TableCell>{(leave.employee as Record<string, Record<string, string>>)?.user?.name}</TableCell>
                    <TableCell>{leave.leaveType as string}</TableCell>
                    <TableCell>{new Date(leave.startDate as string).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(leave.endDate as string).toLocaleDateString()}</TableCell>
                    <TableCell>{leave.totalDays as number}</TableCell>
                    <TableCell className="max-w-xs truncate">{leave.reason as string}</TableCell>
                    <TableCell><StatusBadge status={leave.status as string} /></TableCell>
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
