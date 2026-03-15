"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebounce } from "@/hooks/use-debounce";
import { Eye, Edit, Loader2 } from "lucide-react";

interface Patient {
  id: string; mrn: string; firstName: string; lastName: string; gender: string;
  phone: string; dateOfBirth: string; createdAt: string;
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
      .then((data) => { setPatients(data.data || []); setTotal(data.meta?.total || 0); })
      .finally(() => setLoading(false));
  }, [page, debouncedSearch]);

  return (
    <div className="space-y-4">
      <PageHeader title="Patients" description={`${total} patients registered`} createHref="/patients/new" createLabel="Register Patient" />
      <SearchInput placeholder="Search by name, MRN, or phone..." value={search} onChange={setSearch} />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>MRN</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            ) : patients.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No patients found</TableCell></TableRow>
            ) : (
              patients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-medium">{patient.mrn}</TableCell>
                  <TableCell>{patient.firstName} {patient.lastName}</TableCell>
                  <TableCell><StatusBadge status={patient.gender} /></TableCell>
                  <TableCell>{patient.phone}</TableCell>
                  <TableCell>{new Date(patient.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" asChild><Link href={`/patients/${patient.id}`}><Eye className="h-4 w-4" /></Link></Button>
                      <Button variant="ghost" size="icon" asChild><Link href={`/patients/${patient.id}/edit`}><Edit className="h-4 w-4" /></Link></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
