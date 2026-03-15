"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewVehiclePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vehicleNumber: "", type: "BLS", make: "", model: "", year: "",
    driverName: "", driverPhone: "", paramedicName: "", paramedicPhone: "", gpsTrackingId: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/ambulance/vehicles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, year: form.year ? Number(form.year) : undefined }),
    });
    if (res.ok) router.push("/ambulance");
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Add Ambulance Vehicle" description="Register a new ambulance in the fleet" />
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Vehicle Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Vehicle Number *</Label><Input value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })} required placeholder="e.g., AMB-001" /></div>
              <div>
                <Label>Type *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="BLS">BLS (Basic Life Support)</option><option value="ALS">ALS (Advanced Life Support)</option>
                  <option value="PATIENT_TRANSPORT">Patient Transport</option><option value="NEONATAL">Neonatal</option>
                </select>
              </div>
              <div><Label>Make</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></div>
              <div><Label>Model</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
              <div><Label>Year</Label><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
              <div><Label>GPS Tracking ID</Label><Input value={form.gpsTrackingId} onChange={(e) => setForm({ ...form, gpsTrackingId: e.target.value })} /></div>
              <div><Label>Driver Name</Label><Input value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} /></div>
              <div><Label>Driver Phone</Label><Input value={form.driverPhone} onChange={(e) => setForm({ ...form, driverPhone: e.target.value })} /></div>
              <div><Label>Paramedic Name</Label><Input value={form.paramedicName} onChange={(e) => setForm({ ...form, paramedicName: e.target.value })} /></div>
              <div><Label>Paramedic Phone</Label><Input value={form.paramedicPhone} onChange={(e) => setForm({ ...form, paramedicPhone: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Add Vehicle"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push("/ambulance")}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
