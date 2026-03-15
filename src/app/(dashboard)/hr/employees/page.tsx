"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Eye } from "lucide-react";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/hr/employees?search=${search}`)
      .then((r) => r.json())
      .then((data) => setEmployees(data.data || []))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="space-y-6">
      <PageHeader title="Employees" description="Manage hospital staff">
        <Button asChild><Link href="/hr/employees/new"><Plus className="mr-2 h-4 w-4" />Add Employee</Link></Button>
      </PageHeader>

      <Input placeholder="Search employees..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      <Card>
        <CardContent className="pt-6">
          {loading ? <p className="text-muted-foreground">Loading...</p> : employees.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No employees found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id as string}>
                    <TableCell className="font-medium">{emp.employeeNo as string}</TableCell>
                    <TableCell>{(emp.user as Record<string, string>)?.name}</TableCell>
                    <TableCell>{(emp.department as Record<string, string>)?.name}</TableCell>
                    <TableCell>{emp.designation as string}</TableCell>
                    <TableCell>{emp.phone as string}</TableCell>
                    <TableCell><StatusBadge status={emp.status as string} /></TableCell>
                    <TableCell><Button variant="ghost" size="sm" asChild><Link href={`/hr/employees/${emp.id}`}><Eye className="h-4 w-4" /></Link></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
