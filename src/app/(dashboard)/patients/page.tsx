"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Eye,
  Edit,
  Loader2,
  Search,
  Filter,
  Users,
  FileHeart,
  Pill,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  dateOfBirth: string;
  bloodGroup?: string | null;
  allergies?: string | null;
  createdAt: string;
}

function ageFromDob(dob: string) {
  return Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
    ),
  );
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebounce(search);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/patients?page=${page}&limit=20&search=${debouncedSearch}`)
      .then((r) => r.json())
      .then((data) => {
        setPatients(data.data || []);
        setTotal(data.meta?.total || 0);
      })
      .finally(() => setLoading(false));
  }, [page, debouncedSearch]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Patients</h1>
            <p className="text-sm text-muted-foreground">
              {total} registered patient{total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/patients/new">
            <Users className="mr-2 h-4 w-4" />
            Add Patient
          </Link>
        </Button>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card h-10 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" className="gap-2 h-10">
          <Filter className="h-4 w-4" />
          Filter
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-secondary/50">
                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Patient
                </th>
                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">
                  MRN
                </th>
                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Phone
                </th>
                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Blood
                </th>
                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">
                  Registered
                </th>
                <th className="px-5 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6">
                    <MedicalEmptyState
                      illustration="stethoscope"
                      title="No patients found"
                      description="Register a new patient or try a different search."
                      action={{ label: "Add Patient", href: "/patients/new" }}
                    />
                  </td>
                </tr>
              ) : (
                patients.map((patient) => {
                  const age = ageFromDob(patient.dateOfBirth);
                  return (
                    <tr
                      key={patient.id}
                      className="hover:bg-secondary/30 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/patients/${patient.id}`}
                          className="flex items-center gap-3 group"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-[11px] font-semibold">
                              {patient.firstName[0]}
                              {patient.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium group-hover:text-primary transition-colors">
                              {patient.firstName} {patient.lastName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {age}y · {patient.gender}
                              {patient.allergies ? " · ⚠ Allergy" : ""}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-mono text-muted-foreground">
                          {patient.mrn}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm tabular-nums">
                        {patient.phone}
                      </td>
                      <td className="px-5 py-3.5">
                        {patient.bloodGroup ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-medium"
                          >
                            {patient.bloodGroup
                              .replace(/_POSITIVE$/, "+")
                              .replace(/_NEGATIVE$/, "−")}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground tabular-nums">
                        {new Date(patient.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                          >
                            <Link href={`/patients/${patient.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                          >
                            <Link href={`/emr/${patient.id}`}>
                              <FileHeart className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            asChild
                          >
                            <Link href={`/opd/rx-pad?patientId=${patient.id}`}>
                              <Pill className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground tabular-nums">
            Page {page} of {Math.ceil(total / 20)} · {total} total
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / 20)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
