"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Shield } from "lucide-react";

export default function SettingsPage() {
  const settings = [
    { title: "User Management", description: "Create and manage user accounts", href: "/settings/users", icon: Users },
    { title: "Hospital Profile", description: "Update hospital information and branding", href: "/settings/hospital", icon: Building2 },
    { title: "Roles & Permissions", description: "View role-based access configuration", href: "/settings/roles", icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="System configuration and administration" />
      <div className="grid gap-4 md:grid-cols-3">
        {settings.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center gap-4">
                <s.icon className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>{s.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
