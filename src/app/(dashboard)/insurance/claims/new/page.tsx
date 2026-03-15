"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewInsuranceClaimPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<{ id: string; mrn: string; firstName: string; lastName: string }[]>([]);
  const [providers, setProviders] = useState<{ id: string; name: string; code: string }[]>([]);
  const [policies, setPolicies] = useState<{ id: string; policyNumber: string; providerId: string }[]>([]);
  const [form, setForm] = useState({
    patientId: "", providerId: "", policyId: "", claimType: "CASHLESS",
    claimAmount: "", diagnosis: "", treatmentDetails: "", notes: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/patients?limit=200").then((r) => r.json()),
      fetch("/api/insurance/providers").then((r) => r.json()),
    ]).then(([pData, provData]) => {
      setPatients(pData.data || []);
      setProviders(provData.data || []);
    });
  }, []);

  useEffect(() => {
    if (form.patientId) {
      fetch(`/api/insurance/policies?patientId=${form.patientId}`).then((r) => r.json()).then((d) => setPolicies(d.data || []));
    }
  }, [form.patientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/insurance/claims", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, claimAmount: Number(form.claimAmount) }),
    });
    if (res.ok) router.push("/insurance/claims");
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="New Insurance Claim" description="Submit a new insurance or TPA claim" />
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Claim Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Patient *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required>
                  <option value="">Select Patient</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.mrn})</option>)}
                </select>
              </div>
              <div>
                <Label>Insurance Provider *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })} required>
                  <option value="">Select Provider</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
              </div>
              <div>
                <Label>Policy *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.policyId} onChange={(e) => setForm({ ...form, policyId: e.target.value })} required>
                  <option value="">Select Policy</option>
                  {policies.map((p) => <option key={p.id} value={p.id}>{p.policyNumber}</option>)}
                </select>
              </div>
              <div>
                <Label>Claim Type *</Label>
                <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={form.claimType} onChange={(e) => setForm({ ...form, claimType: e.target.value })}>
                  <option value="PRE_AUTH">Pre-Authorization</option><option value="CASHLESS">Cashless</option><option value="REIMBURSEMENT">Reimbursement</option>
                </select>
              </div>
              <div><Label>Claim Amount *</Label><Input type="number" step="0.01" value={form.claimAmount} onChange={(e) => setForm({ ...form, claimAmount: e.target.value })} required /></div>
              <div className="md:col-span-2"><Label>Diagnosis *</Label><Textarea value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} required /></div>
              <div className="md:col-span-2"><Label>Treatment Details</Label><Textarea value={form.treatmentDetails} onChange={(e) => setForm({ ...form, treatmentDetails: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>{saving ? "Submitting..." : "Submit Claim"}</Button>
              <Button type="button" variant="outline" onClick={() => router.push("/insurance/claims")}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
