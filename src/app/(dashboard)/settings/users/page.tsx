"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export default function UsersPage() {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "RECEPTIONIST" });

  const loadUsers = () => {
    fetch("/api/settings/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/settings/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ name: "", email: "", password: "", role: "RECEPTIONIST" });
      setOpen(false);
      loadUsers();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" description="Manage system user accounts">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add User</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required /></div>
              <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required minLength={6} /></div>
              <div>
                <Label>Role</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
                  <option value="ADMIN">Admin</option>
                  <option value="DOCTOR">Doctor</option>
                  <option value="NURSE">Nurse</option>
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="PHARMACIST">Pharmacist</option>
                  <option value="LAB_TECHNICIAN">Lab Technician</option>
                  <option value="RADIOLOGIST">Radiologist</option>
                  <option value="ACCOUNTANT">Accountant</option>
                </select>
              </div>
              <Button type="submit">Create User</Button>
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
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id as string}>
                    <TableCell className="font-medium">{user.name as string}</TableCell>
                    <TableCell>{user.email as string}</TableCell>
                    <TableCell><StatusBadge status={user.role as string} /></TableCell>
                    <TableCell>{new Date(user.createdAt as string).toLocaleDateString()}</TableCell>
                    <TableCell><span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">{user.isActive ? "Active" : "Inactive"}</span></TableCell>
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
