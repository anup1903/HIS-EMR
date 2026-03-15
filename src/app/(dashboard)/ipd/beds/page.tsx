"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/shared/stats-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BedDouble, CheckCircle, XCircle, Wrench } from "lucide-react";

interface Bed {
  id: string;
  bedNumber: string;
  status: string;
  dailyRate: string;
  admissions?: { id: string; patient: { firstName: string; lastName: string; mrn: string } }[];
}

interface Ward {
  id: string;
  name: string;
  type: string;
  floor: number;
  department: { name: string };
  beds: Bed[];
}

export default function BedManagementPage() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ipd/beds")
      .then((r) => r.json())
      .then((data) => setWards(data.data || []))
      .finally(() => setLoading(false));
  }, []);

  const allBeds = wards.flatMap((w) => w.beds);
  const available = allBeds.filter((b) => b.status === "AVAILABLE").length;
  const occupied = allBeds.filter((b) => b.status === "OCCUPIED").length;
  const maintenance = allBeds.filter((b) => b.status === "MAINTENANCE").length;

  const statusColor: Record<string, string> = {
    AVAILABLE: "bg-green-100 text-green-700 border-green-300",
    OCCUPIED: "bg-red-100 text-red-700 border-red-300",
    MAINTENANCE: "bg-yellow-100 text-yellow-700 border-yellow-300",
    RESERVED: "bg-blue-100 text-blue-700 border-blue-300",
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Bed Management" description="Visual bed occupancy across all wards" />

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Beds" value={allBeds.length} icon={BedDouble} />
        <StatsCard title="Available" value={available} icon={CheckCircle} />
        <StatsCard title="Occupied" value={occupied} icon={XCircle} />
        <StatsCard title="Maintenance" value={maintenance} icon={Wrench} />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : wards.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">No wards configured</CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {wards.map((ward) => {
            const wOccupied = ward.beds.filter((b) => b.status === "OCCUPIED").length;
            return (
              <Card key={ward.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{ward.name}</CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {wOccupied}/{ward.beds.length} occupied
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {ward.department.name} &middot; Floor {ward.floor} &middot; {ward.type}
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-red-500 h-2 rounded-full transition-all"
                      style={{ width: `${ward.beds.length ? (wOccupied / ward.beds.length) * 100 : 0}%` }}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {ward.beds.map((bed) => {
                      const patient = bed.admissions?.[0]?.patient;
                      return (
                        <div
                          key={bed.id}
                          className={`border rounded-lg p-2 text-center text-xs font-medium cursor-default ${statusColor[bed.status] || "bg-gray-100 text-gray-700"}`}
                          title={patient ? `${patient.firstName} ${patient.lastName} (${patient.mrn})` : bed.status}
                        >
                          <div className="font-bold">{bed.bedNumber}</div>
                          <div className="text-[10px] mt-0.5 truncate">
                            {patient ? `${patient.firstName} ${patient.lastName.charAt(0)}.` : bed.status.toLowerCase()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6 text-sm">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-200 border border-green-400" /> Available</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-200 border border-red-400" /> Occupied</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-200 border border-yellow-400" /> Maintenance</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-200 border border-blue-400" /> Reserved</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
