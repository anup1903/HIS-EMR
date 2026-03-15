"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "" });

  const loadDepartments = () => {
    fetch("/api/hr/departments")
      .then((r) => r.json())
      .then((data) => setDepartments(data.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDepartments(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/hr/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ name: "", code: "", description: "" });
      setOpen(false);
      loadDepartments();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Departments" description="Manage hospital departments">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add Department</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Department</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required /></div>
              <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} required /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
              <Button type="submit">Create Department</Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          {loading ? <p className="text-muted-foreground">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id as string}>
                    <TableCell className="font-medium">{dept.name as string}</TableCell>
                    <TableCell>{dept.code as string}</TableCell>
                    <TableCell>{(dept.description as string) || "N/A"}</TableCell>
                    <TableCell>{(dept._count as Record<string, number>)?.employees || 0}</TableCell>
                    <TableCell><span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">{dept.isActive ? "Active" : "Inactive"}</span></TableCell>
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
