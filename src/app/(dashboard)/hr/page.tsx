"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StatsCard } from "@/components/shared/stats-card";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Users, Building2, CalendarDays, DollarSign, Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function HRPage() {
  const [stats, setStats] = useState({ employees: 0, departments: 0, pendingLeaves: 0 });
  const [employees, setEmployees] = useState<Record<string, unknown>[]>([]);
  const [departments, setDepartments] = useState<Record<string, unknown>[]>([]);
  const [leaves, setLeaves] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/hr/employees").then((r) => r.json()),
      fetch("/api/hr/departments").then((r) => r.json()),
      fetch("/api/hr/leave?status=PENDING").then((r) => r.json()),
    ]).then(([eData, dData, lData]) => {
      const empList = eData.data || [];
      const deptList = dData.data || [];
      const leaveList = lData.data || [];
      setEmployees(empList);
      setDepartments(deptList);
      setLeaves(leaveList);
      setStats({
        employees: empList.length,
        departments: deptList.length,
        pendingLeaves: leaveList.length,
      });
    }).finally(() => setLoading(false));
  }, []);

  const filteredEmployees = employees.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      ((e.firstName as string) || "").toLowerCase().includes(s) ||
      ((e.lastName as string) || "").toLowerCase().includes(s) ||
      ((e.employeeId as string) || "").toLowerCase().includes(s) ||
      ((e.email as string) || "").toLowerCase().includes(s)
    );
  });

  const getInitials = (emp: Record<string, unknown>) => {
    const first = ((emp.firstName as string) || "")[0] || "";
    const last = ((emp.lastName as string) || "")[0] || "";
    return (first + last).toUpperCase();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: "bg-success/10 text-success",
      ON_LEAVE: "bg-warning/10 text-warning",
      INACTIVE: "bg-muted text-muted-foreground",
    };
    return (
      <Badge className={cn("text-[10px] border-0", map[status] || "bg-muted text-muted-foreground")}>
        {status?.replace(/_/g, " ")}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">HR & Payroll</h1>
            <p className="text-sm text-muted-foreground">Employee records, attendance, and payroll.</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/hr/employees/new">
            <UserPlus className="mr-2 h-4 w-4" />Add Employee
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Total Employees" value={stats.employees} icon={Users} accent="primary" />
        <StatsCard title="Departments" value={stats.departments} icon={Building2} accent="info" />
        <StatsCard title="Pending Leaves" value={stats.pendingLeaves} icon={CalendarDays} accent="warning" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
        </TabsList>

        {/* Employees Tab */}
        <TabsContent value="employees">
          <Card>
            <CardContent className="pt-6">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees by name, ID, or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {loading ? (
                <p className="text-muted-foreground text-center py-8">Loading...</p>
              ) : filteredEmployees.length === 0 ? (
                <MedicalEmptyState
                  illustration="stethoscope"
                  title="No employees found"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Employee</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">ID</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Department</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Role</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((emp) => (
                      <TableRow key={emp.id as string} className="hover:bg-secondary/30 transition-colors">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {getInitials(emp)}
                            </div>
                            <div>
                              <p className="font-medium">{emp.firstName as string} {emp.lastName as string}</p>
                              <p className="text-xs text-muted-foreground">{emp.email as string}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{emp.employeeId as string}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {(emp.department as Record<string, string>)?.name || "Unassigned"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{(emp.designation as string) || (emp.role as string) || "-"}</TableCell>
                        <TableCell>{statusBadge((emp.status as string) || "ACTIVE")}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/hr/employees/${emp.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments">
          <Card>
            <CardContent className="pt-6">
              {departments.length === 0 ? (
                <MedicalEmptyState
                  illustration="inbox"
                  title="No departments found"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Department</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Code</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Head</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map((dept) => (
                      <TableRow key={dept.id as string} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-medium">{dept.name as string}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">{dept.code as string}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{(dept.headName as string) || "-"}</TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[10px] border-0",
                            dept.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                          )}>
                            {dept.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leave Tab */}
        <TabsContent value="leave">
          <Card>
            <CardContent className="pt-6">
              {leaves.length === 0 ? (
                <MedicalEmptyState
                  illustration="calendar"
                  title="No pending leave requests"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/50">
                      <TableHead className="text-[11px] uppercase tracking-wider">Employee</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Type</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">From</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">To</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaves.map((leave) => (
                      <TableRow key={leave.id as string} className="hover:bg-secondary/30 transition-colors">
                        <TableCell className="font-medium">
                          {(leave.employee as Record<string, string>)?.firstName}{" "}
                          {(leave.employee as Record<string, string>)?.lastName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">{leave.leaveType as string}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {leave.startDate ? new Date(leave.startDate as string).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {leave.endDate ? new Date(leave.endDate as string).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[10px] border-0",
                            leave.status === "APPROVED" ? "bg-success/10 text-success" :
                            leave.status === "PENDING" ? "bg-warning/10 text-warning" :
                            "bg-destructive/10 text-destructive"
                          )}>
                            {leave.status as string}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/hr/leave/${leave.id}`}>Review</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">Salary processing and payslips</p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/hr/payroll">
                    <DollarSign className="mr-2 h-4 w-4" />Open Payroll
                  </Link>
                </Button>
              </div>
              <MedicalEmptyState
                illustration="ecg"
                title="Navigate to Payroll module for full details"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
