"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileHeart, Search, ChevronRight, AlertTriangle } from "lucide-react";

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup?: string | null;
  allergies?: string | null;
  chronicConditions?: string | null;
  phone?: string;
}

export default function EMRIndexPage() {
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/patients?limit=50")
      .then((r) => r.json())
      .then((j) => setPatients(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) return;
    const h = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/patients/search?q=${encodeURIComponent(query)}`);
        const j = await r.json();
        setPatients(j.data ?? []);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(h);
  }, [q]);

  const filtered = useMemo(() => patients, [patients]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Electronic Medical Records"
        description="Pick a patient to view their full history, vitals, prescriptions, labs, and imaging"
      />

      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, MRN, or phone…"
              className="pl-9 h-11 text-base"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            {q.length >= 2 ? "Search results" : "Recent patients"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No patients found.
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((p) => {
                const age = Math.max(
                  0,
                  Math.floor(
                    (Date.now() - new Date(p.dateOfBirth).getTime()) /
                      (1000 * 60 * 60 * 24 * 365.25),
                  ),
                );
                return (
                  <Link
                    key={p.id}
                    href={`/emr/${p.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold shrink-0">
                      {p.firstName[0]}
                      {p.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate group-hover:text-primary">
                        {p.firstName} {p.lastName}
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums truncate">
                        MRN {p.mrn} · {age}
                        {p.gender?.charAt(0)} · {p.bloodGroup ?? "—"}
                        {p.phone ? ` · ${p.phone}` : ""}
                      </div>
                    </div>
                    {p.allergies && (
                      <span className="hidden md:inline-flex items-center gap-1 text-[10px] bg-destructive/10 text-destructive rounded px-1.5 py-0.5">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Allergy
                      </span>
                    )}
                    <FileHeart className="h-4 w-4 text-muted-foreground shrink-0" />
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
