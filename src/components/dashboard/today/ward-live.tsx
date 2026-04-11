"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BedDouble,
  Activity,
  Clock,
  AlertTriangle,
  User as UserIcon,
  Stethoscope,
  Radio,
} from "lucide-react";
import { StatsCard } from "@/components/shared/stats-card";
import { cn } from "@/lib/utils";

interface LivePatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  allergies: string | null;
}

interface LiveAdmission {
  id: string;
  admissionDate: string;
  admissionReason: string;
  doctorName: string;
  patient: LivePatient;
}

interface LiveBed {
  id: string;
  bedNumber: string;
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "RESERVED";
  admission: LiveAdmission | null;
}

interface LiveWard {
  id: string;
  name: string;
  floor: number;
  department: string;
  beds: LiveBed[];
}

interface LiveStats {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  maintenanceBeds: number;
  occupancyPct: number;
}

interface Snapshot {
  ts: string;
  stats: LiveStats;
  wards: LiveWard[];
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86400000));
}
function ageFromDob(dob: string) {
  return Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
    ),
  );
}

/**
 * Live ward board powered by `/api/ward/stream` (Server-Sent Events).
 *
 * The Nurse Day server component hands us an initial `snapshot` so
 * the first paint is SSR-fast; we subscribe on the client for updates.
 */
export function WardLiveBoard({ initial }: { initial: Snapshot }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date(initial.ts));

  useEffect(() => {
    const es = new EventSource("/api/ward/stream?interval=5000");

    es.addEventListener("hello", () => setConnected(true));
    es.addEventListener("snapshot", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as Snapshot;
        setSnapshot(data);
        setLastUpdated(new Date(data.ts));
      } catch {
        /* ignore bad frames */
      }
    });
    es.onerror = () => setConnected(false);

    return () => {
      es.close();
    };
  }, []);

  const { stats, wards } = snapshot;

  return (
    <div className="space-y-6">
      {/* Live status strip */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={connected ? "default" : "secondary"}
          className={cn(
            "gap-1 text-[10px]",
            connected && "bg-success/15 text-success border-success/30",
          )}
        >
          <Radio
            className={cn("h-3 w-3", connected && "animate-pulse")}
          />
          {connected ? "Live" : "Reconnecting…"}
        </Badge>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          Last update {lastUpdated.toLocaleTimeString()}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Occupancy"
          value={`${stats.occupancyPct}%`}
          icon={Activity}
          description={`${stats.occupiedBeds}/${stats.totalBeds} beds`}
          accent="primary"
        />
        <StatsCard
          title="Available"
          value={stats.availableBeds}
          icon={BedDouble}
          accent="success"
          description="Ready for admission"
        />
        <StatsCard
          title="Occupied"
          value={stats.occupiedBeds}
          icon={UserIcon}
          accent="info"
          description="Currently admitted"
        />
        <StatsCard
          title="Maintenance"
          value={stats.maintenanceBeds}
          icon={AlertTriangle}
          accent="warning"
          description="Out of service"
        />
      </div>

      <div className="space-y-4">
        {wards.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No wards configured.
            </CardContent>
          </Card>
        ) : (
          wards.map((ward) => {
            const wardOccupied = ward.beds.filter(
              (b) => b.status === "OCCUPIED",
            ).length;
            return (
              <Card key={ward.id} className="overflow-hidden">
                <CardHeader className="pb-3 bg-muted/40">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BedDouble className="h-4 w-4 text-primary" />
                    {ward.name}
                    <span className="text-xs font-normal text-muted-foreground">
                      · {ward.department} · Floor {ward.floor}
                    </span>
                    <span className="ml-auto text-xs font-normal tabular-nums text-muted-foreground">
                      {wardOccupied}/{ward.beds.length} occupied
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {ward.beds.map((bed) => (
                      <LiveBedCard key={bed.id} bed={bed} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function LiveBedCard({ bed }: { bed: LiveBed }) {
  const isOccupied = bed.status === "OCCUPIED" && bed.admission;
  const isAvailable = bed.status === "AVAILABLE";
  const isMaintenance = bed.status === "MAINTENANCE";
  const isReserved = bed.status === "RESERVED";

  const toneBorder = cn(
    isOccupied && "border-primary/40",
    isAvailable && "border-success/40",
    isMaintenance && "border-warning/40",
    isReserved && "border-info/40",
  );
  const toneChip = cn(
    "text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded",
    isOccupied && "bg-primary/10 text-primary",
    isAvailable && "bg-success/10 text-success",
    isMaintenance && "bg-warning/10 text-warning",
    isReserved && "bg-info/10 text-info",
  );

  if (!isOccupied || !bed.admission) {
    return (
      <div className={cn("rounded-lg border bg-card p-3 space-y-2", toneBorder)}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">{bed.bedNumber}</span>
          <span className={toneChip}>{bed.status}</span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          {isAvailable && "Ready for admission"}
          {isMaintenance && "Out of service"}
          {isReserved && "Reserved"}
        </div>
        {isAvailable && (
          <Button asChild variant="outline" size="sm" className="h-7 w-full text-xs">
            <Link href="/ipd">Admit patient</Link>
          </Button>
        )}
      </div>
    );
  }

  const patient = bed.admission.patient;
  const age = ageFromDob(patient.dateOfBirth);
  const los = daysBetween(new Date(bed.admission.admissionDate), new Date());

  return (
    <div className={cn("rounded-lg border bg-card p-3 space-y-2", toneBorder)}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">{bed.bedNumber}</span>
        <span className={toneChip}>OCC</span>
      </div>

      <Link href={`/patients/${patient.id}`} className="block group">
        <div className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
          {patient.firstName} {patient.lastName}
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums truncate">
          MRN {patient.mrn} · {age}
          {patient.gender?.charAt(0)}
        </div>
      </Link>

      {patient.allergies && (
        <Badge variant="destructive" className="text-[10px] gap-1 max-w-full truncate">
          <AlertTriangle className="h-2.5 w-2.5" />
          {patient.allergies}
        </Badge>
      )}

      <div className="text-[11px] text-muted-foreground truncate">
        <Stethoscope className="inline h-3 w-3 mr-1" />
        Dr. {bed.admission.doctorName}
      </div>
      <div className="text-[11px] text-muted-foreground truncate">
        <Clock className="inline h-3 w-3 mr-1" />
        Day {los} · {bed.admission.admissionReason}
      </div>

      <div className="flex gap-1.5 pt-1">
        <Button asChild size="sm" className="h-7 flex-1 text-xs">
          <Link href="/ipd">Chart</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link href="/ipd/nursing">Vitals</Link>
        </Button>
      </div>
    </div>
  );
}
