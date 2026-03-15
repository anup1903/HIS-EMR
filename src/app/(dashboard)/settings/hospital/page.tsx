"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function HospitalSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: "", address: "", city: "", state: "", zipCode: "", country: "",
    phone: "", email: "", website: "", registrationNo: "", taxId: "",
  });

  useEffect(() => {
    fetch("/api/settings/hospital")
      .then((r) => r.json())
      .then((data) => {
        if (data.data) {
          const h = data.data;
          setForm({
            name: h.name || "", address: h.address || "", city: h.city || "",
            state: h.state || "", zipCode: h.zipCode || "", country: h.country || "",
            phone: h.phone || "", email: h.email || "", website: h.website || "",
            registrationNo: h.registrationNo || "", taxId: h.taxId || "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/hospital", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) setSaved(true);
    } finally { setSaving(false); }
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Hospital Profile" description="Update hospital information" />
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>General Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Label>Hospital Name</Label><Input value={form.name} onChange={(e) => update("name", e.target.value)} required /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></div>
            <div><Label>Website</Label><Input value={form.website} onChange={(e) => update("website", e.target.value)} /></div>
            <div><Label>Registration No.</Label><Input value={form.registrationNo} onChange={(e) => update("registrationNo", e.target.value)} /></div>
            <div><Label>Tax ID</Label><Input value={form.taxId} onChange={(e) => update("taxId", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Address</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => update("address", e.target.value)} /></div>
            <div><Label>City</Label><Input value={form.city} onChange={(e) => update("city", e.target.value)} /></div>
            <div><Label>State</Label><Input value={form.state} onChange={(e) => update("state", e.target.value)} /></div>
            <div><Label>Zip Code</Label><Input value={form.zipCode} onChange={(e) => update("zipCode", e.target.value)} /></div>
            <div><Label>Country</Label><Input value={form.country} onChange={(e) => update("country", e.target.value)} /></div>
          </CardContent>
        </Card>

        <div className="flex gap-4 items-center">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          {saved && <span className="text-sm text-green-600">Settings saved successfully!</span>}
        </div>
      </form>
    </div>
  );
}
