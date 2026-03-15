"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewDispatchPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [vehicles, setVehicles] = useState<{ id: string; vehicleNumber: string; type: string; status: string }[]>([]);
  const [form, setForm] = useState({
    ambulanceId: "", patientName: "", patientPhone: "", pickupAddress: "",
    dropAddress: "", tripType: "EMERGENCY", priority: "URGENT", chiefComplaint: "", notes: "",
  });

  useEffect(() => {
    fetch("/api/ambulance/vehicles").then((r) => r.json()).then((d) => setVehicles((d.data || []).filter((v: Record<string, unknown>) => v.status === "AVAILABLE")));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/ambulance/dispatches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) router.push("/ambulance");
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="New Ambulance Dispatch" description="Dispatch an ambulance for emergency or transport" />
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Dispatch Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Ambulance *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.ambulanceId} onChange={(e) => setForm({ ...form, ambulanceId: e.target.value })} required>
                  <option value="">Select Available Vehicle</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.vehicleNumber} ({v.type})</option>)}
                </select>
              </div>
              <div>
                <Label>Trip Type *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.tripType} onChange={(e) => setForm({ ...form, tripType: e.target.value })}>
                  <option value="EMERGENCY">Emergency</option><option value="TRANSFER">Transfer</option>
                  <option value="PICKUP">Pickup</option><option value="RETURN">Return</option>
                </select>
              </div>
              <div>
                <Label>Priority *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="URGENT">Urgent</option><option value="ROUTINE">Routine</option>
                </select>
              </div>
              <div><Label>Patient Name</Label><Input value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} /></div>
              <div><Label>Patient Phone</Label><Input value={form.patientPhone} onChange={(e) => setForm({ ...form, patientPhone: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Pickup Address *</Label><Textarea value={form.pickupAddress} onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })} required /></div>
              <div className="md:col-span-2"><Label>Drop Address</Label><Textarea value={form.dropAddress} onChange={(e) => setForm({ ...form, dropAddress: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Chief Complaint</Label><Textarea value={form.chiefComplaint} onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Dispatching..." : "Dispatch Ambulance"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push("/ambulance")}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
