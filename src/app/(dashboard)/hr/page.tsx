"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, CalendarDays, DollarSign } from "lucide-react";

export default function HRPage() {
  const [stats, setStats] = useState({ employees: 0, departments: 0, pendingLeaves: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/hr/employees").then((r) => r.json()),
      fetch("/api/hr/departments").then((r) => r.json()),
      fetch("/api/hr/leave?status=PENDING").then((r) => r.json()),
    ]).then(([eData, dData, lData]) => {
      setStats({
        employees: eData.data?.length || 0,
        departments: dData.data?.length || 0,
        pendingLeaves: lData.data?.length || 0,
      });
    }).finally(() => setLoading(false));
  }, []);

  const modules = [
    { title: "Employees", description: "Manage staff records and assignments", href: "/hr/employees", icon: Users },
    { title: "Departments", description: "Hospital departments and teams", href: "/hr/departments", icon: Building2 },
    { title: "Leave Management", description: "Leave requests and approvals", href: "/hr/leave", icon: CalendarDays },
    { title: "Payroll", description: "Salary processing and payslips", href: "/hr/payroll", icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Human Resources" description="Employee management, leave, and payroll" />

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Total Employees" value={stats.employees} icon={Users} />
        <StatsCard title="Departments" value={stats.departments} icon={Building2} />
        <StatsCard title="Pending Leaves" value={stats.pendingLeaves} icon={CalendarDays} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((mod) => (
          <Link key={mod.href} href={mod.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center gap-4">
                <mod.icon className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>{mod.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{mod.description}</p>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
