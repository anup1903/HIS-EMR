"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PatientEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", dateOfBirth: "", gender: "MALE",
    phone: "", email: "", address: "", city: "", state: "", zipCode: "",
    bloodGroup: "", maritalStatus: "", allergies: "", chronicConditions: "",
    emergencyName: "", emergencyPhone: "", emergencyRelation: "",
    insuranceProvider: "", insurancePolicyNo: "",
  });

  useEffect(() => {
    fetch(`/api/patients/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.data) {
          const p = data.data;
          setForm({
            firstName: p.firstName || "", lastName: p.lastName || "",
            dateOfBirth: p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split("T")[0] : "",
            gender: p.gender || "MALE", phone: p.phone || "", email: p.email || "",
            address: p.address || "", city: p.city || "", state: p.state || "", zipCode: p.zipCode || "",
            bloodGroup: p.bloodGroup || "", maritalStatus: p.maritalStatus || "",
            allergies: p.allergies || "", chronicConditions: p.chronicConditions || "",
            emergencyName: p.emergencyName || "", emergencyPhone: p.emergencyPhone || "",
            emergencyRelation: p.emergencyRelation || "",
            insuranceProvider: p.insuranceProvider || "", insurancePolicyNo: p.insurancePolicyNo || "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/patients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) router.push(`/patients/${id}`);
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Patient" description="Update patient information" />
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label>First Name</Label><Input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} required /></div>
            <div><Label>Last Name</Label><Input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} required /></div>
            <div><Label>Date of Birth</Label><Input type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} required /></div>
            <div><Label>Gender</Label>
              <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.gender} onChange={(e) => update("gender", e.target.value)}>
                <option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
              </select>
            </div>
            <div><Label>Blood Group</Label><Input value={form.bloodGroup} onChange={(e) => update("bloodGroup", e.target.value)} /></div>
            <div><Label>Marital Status</Label><Input value={form.maritalStatus} onChange={(e) => update("maritalStatus", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => update("phone", e.target.value)} required /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Address</Label><Input value={form.address} onChange={(e) => update("address", e.target.value)} /></div>
            <div><Label>City</Label><Input value={form.city} onChange={(e) => update("city", e.target.value)} /></div>
            <div><Label>State</Label><Input value={form.state} onChange={(e) => update("state", e.target.value)} /></div>
            <div><Label>Zip Code</Label><Input value={form.zipCode} onChange={(e) => update("zipCode", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Medical Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><Label>Allergies</Label><Textarea value={form.allergies} onChange={(e) => update("allergies", e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Chronic Conditions</Label><Textarea value={form.chronicConditions} onChange={(e) => update("chronicConditions", e.target.value)} /></div>
            <div><Label>Insurance Provider</Label><Input value={form.insuranceProvider} onChange={(e) => update("insuranceProvider", e.target.value)} /></div>
            <div><Label>Policy Number</Label><Input value={form.insurancePolicyNo} onChange={(e) => update("insurancePolicyNo", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Emergency Contact</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div><Label>Name</Label><Input value={form.emergencyName} onChange={(e) => update("emergencyName", e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={form.emergencyPhone} onChange={(e) => update("emergencyPhone", e.target.value)} /></div>
            <div><Label>Relation</Label><Input value={form.emergencyRelation} onChange={(e) => update("emergencyRelation", e.target.value)} /></div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
