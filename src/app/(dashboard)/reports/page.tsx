"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, Building2, Package } from "lucide-react";

export default function ReportsPage() {
  const reports = [
    { title: "Financial Report", description: "Revenue, collections, and outstanding balances", href: "/reports/financial", icon: DollarSign },
    { title: "Patient Statistics", description: "Patient demographics and visit trends", href: "/reports/patients", icon: Users },
    { title: "Department Report", description: "Department-wise performance and workload", href: "/reports/departments", icon: Building2 },
    { title: "Inventory Report", description: "Stock levels, consumption, and procurement", href: "/reports/inventory", icon: Package },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Analytics and reporting dashboard" />
      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => (
          <Link key={report.href} href={report.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center gap-4">
                <report.icon className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>{report.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{report.description}</p>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
