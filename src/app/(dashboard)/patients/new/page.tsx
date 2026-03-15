"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function NewPatientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};
    formData.forEach((value, key) => { if (value) body[key] = value; });

    const res = await fetch("/api/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setLoading(false);

    if (data.success) {
      router.push(`/patients/${data.data.id}`);
    } else {
      setError(data.error || "Failed to register patient");
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Register New Patient" description="Fill in the patient details below" />

      {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" name="firstName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input id="lastName" name="lastName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth *</Label>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <Select name="gender" required>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bloodGroup">Blood Group</Label>
              <Select name="bloodGroup">
                <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
                <SelectContent>
                  {["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"].map((bg) => (
                    <SelectItem key={bg} value={bg}>{bg.replace("_", "").replace("POSITIVE", "+").replace("NEGATIVE", "-")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maritalStatus">Marital Status</Label>
              <Select name="maritalStatus">
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SINGLE">Single</SelectItem>
                  <SelectItem value="MARRIED">Married</SelectItem>
                  <SelectItem value="DIVORCED">Divorced</SelectItem>
                  <SelectItem value="WIDOWED">Widowed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contact Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input id="phone" name="phone" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address *</Label>
              <Input id="address" name="address" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input id="city" name="city" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input id="state" name="state" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">ZIP Code *</Label>
              <Input id="zipCode" name="zipCode" required />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Emergency Contact</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="emergencyName">Name</Label><Input id="emergencyName" name="emergencyName" /></div>
            <div className="space-y-2"><Label htmlFor="emergencyPhone">Phone</Label><Input id="emergencyPhone" name="emergencyPhone" /></div>
            <div className="space-y-2"><Label htmlFor="emergencyRelation">Relation</Label><Input id="emergencyRelation" name="emergencyRelation" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Medical Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="allergies">Allergies</Label><Textarea id="allergies" name="allergies" /></div>
            <div className="space-y-2"><Label htmlFor="chronicConditions">Chronic Conditions</Label><Textarea id="chronicConditions" name="chronicConditions" /></div>
            <div className="space-y-2"><Label htmlFor="insuranceProvider">Insurance Provider</Label><Input id="insuranceProvider" name="insuranceProvider" /></div>
            <div className="space-y-2"><Label htmlFor="insurancePolicyNo">Policy Number</Label><Input id="insurancePolicyNo" name="insurancePolicyNo" /></div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registering...</> : "Register Patient"}
          </Button>
        </div>
      </form>
    </div>
  );
}
