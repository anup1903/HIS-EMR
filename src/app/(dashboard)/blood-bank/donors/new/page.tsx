"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewDonorPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", dateOfBirth: "", gender: "MALE", bloodGroup: "O_POSITIVE",
    phone: "", email: "", address: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/blood-bank/donors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) router.push("/blood-bank");
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Register Blood Donor" description="Add a new blood donor to the system" />
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Donor Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>First Name *</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
              <div><Label>Last Name *</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></div>
              <div><Label>Date of Birth *</Label><Input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} required /></div>
              <div>
                <Label>Gender *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <Label>Blood Group *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
                  {["A_POSITIVE","A_NEGATIVE","B_POSITIVE","B_NEGATIVE","AB_POSITIVE","AB_NEGATIVE","O_POSITIVE","O_NEGATIVE"].map((bg) => (
                    <option key={bg} value={bg}>{bg.replace(/_/g, " ").replace("POSITIVE", "+").replace("NEGATIVE", "-")}</option>
                  ))}
                </select>
              </div>
              <div><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Register Donor"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push("/blood-bank")}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
