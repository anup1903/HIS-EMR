"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X, MapPin, Wrench, Stethoscope } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  GENERAL: "border-blue-300 bg-blue-50",
  CARDIAC: "border-red-300 bg-red-50",
  NEURO: "border-purple-300 bg-purple-50",
  ORTHO: "border-green-300 bg-green-50",
  EMERGENCY: "border-orange-300 bg-orange-50",
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  GENERAL: "bg-blue-100 text-blue-800",
  CARDIAC: "bg-red-100 text-red-800",
  NEURO: "bg-purple-100 text-purple-800",
  ORTHO: "bg-green-100 text-green-800",
  EMERGENCY: "bg-orange-100 text-orange-800",
};

export default function OperationTheatresPage() {
  const [theatres, setTheatres] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    code: "",
    type: "GENERAL",
    location: "",
    equipment: "",
  });

  const fetchTheatres = () => {
    setLoading(true);
    fetch("/api/surgery/theatres")
      .then((r) => r.json())
      .then((data) => setTheatres(data.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTheatres();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!form.name || !form.code) {
      setErrorMsg("Name and code are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/surgery/theatres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          equipment: form.equipment
            ? form.equipment.split(",").map((s) => s.trim())
            : [],
        }),
      });
      if (res.ok) {
        setForm({ name: "", code: "", type: "GENERAL", location: "", equipment: "" });
        setShowForm(false);
        fetchTheatres();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Failed to add theatre");
      }
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Operation Theatres" description="Manage operation theatres and their schedules">
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? (
            <>
              <X className="mr-2 h-4 w-4" />Cancel
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />Add Theatre
            </>
          )}
        </Button>
      </PageHeader>

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Add New Theatre</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg ? (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {errorMsg}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="e.g. Operation Theatre 1"
                    required
                  />
                </div>
                <div>
                  <Label>Code *</Label>
                  <Input
                    value={form.code}
                    onChange={(e) => update("code", e.target.value)}
                    placeholder="e.g. OT-01"
                    required
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <select
                    className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                    value={form.type}
                    onChange={(e) => update("type", e.target.value)}
                  >
                    <option value="GENERAL">General</option>
                    <option value="CARDIAC">Cardiac</option>
                    <option value="NEURO">Neuro</option>
                    <option value="ORTHO">Ortho</option>
                    <option value="EMERGENCY">Emergency</option>
                  </select>
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    value={form.location}
                    onChange={(e) => update("location", e.target.value)}
                    placeholder="e.g. Building A, Floor 2"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Equipment (comma separated)</Label>
                  <Input
                    value={form.equipment}
                    onChange={(e) => update("equipment", e.target.value)}
                    placeholder="e.g. Ventilator, Heart-lung machine, C-arm"
                  />
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Adding..." : "Add Theatre"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : theatres.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          No operation theatres found. Add one to get started.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {theatres.map((theatre) => {
            const theatreType = (theatre.type as string) || "GENERAL";
            const borderColor = TYPE_COLORS[theatreType] || TYPE_COLORS.GENERAL;
            const badgeColor = TYPE_BADGE_COLORS[theatreType] || TYPE_BADGE_COLORS.GENERAL;
            const equipment = (theatre.equipment as string[]) || [];
            const surgeriesCount = ((theatre.surgeries as unknown[]) || []).length;

            return (
              <Card
                key={theatre.id as string}
                className={`border-2 ${borderColor}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {theatre.name as string}
                    </CardTitle>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}
                    >
                      {theatreType}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Code: {theatre.code as string}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {theatre.location ? (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{theatre.location as string}</span>
                    </div>
                  ) : null}

                  {equipment.length > 0 ? (
                    <div className="flex items-start gap-2 text-sm">
                      <Wrench className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex flex-wrap gap-1">
                        {equipment.map((eq, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs"
                          >
                            {eq}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-2 text-sm">
                    <Stethoscope className="h-4 w-4 text-muted-foreground" />
                    <span>{surgeriesCount} scheduled surgeries</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
