"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewEmployeePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<Record<string, string>[]>([]);
  const [form, setForm] = useState({
    userId: "", departmentId: "", designation: "",
    phone: "", dateOfJoining: new Date().toISOString().split("T")[0],
    baseSalary: 0, address: "",
  });

  useEffect(() => {
    fetch("/api/hr/departments").then((r) => r.json()).then((data) => setDepartments(data.data || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) router.push("/hr/employees");
    } finally { setSaving(false); }
  };

  const update = (field: string, value: string | number) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6">
      <PageHeader title="Add Employee" description="Register a new hospital staff member" />
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Employee Details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Department</Label>
              <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.departmentId} onChange={(e) => update("departmentId", e.target.value)} required>
                <option value="">Select Department</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><Label>Designation</Label><Input value={form.designation} onChange={(e) => update("designation", e.target.value)} required /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} required /></div>
            <div><Label>Date of Joining</Label><Input type="date" value={form.dateOfJoining} onChange={(e) => update("dateOfJoining", e.target.value)} required /></div>
            <div><Label>Base Salary ($)</Label><Input type="number" min="0" step="0.01" value={form.baseSalary} onChange={(e) => update("baseSalary", parseFloat(e.target.value) || 0)} /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => update("address", e.target.value)} /></div>
          </CardContent>
        </Card>
        <div className="flex gap-4">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Add Employee"}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
