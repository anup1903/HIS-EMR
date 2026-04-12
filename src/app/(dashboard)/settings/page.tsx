"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Shield, Settings } from "lucide-react";

export default function SettingsPage() {
  const settings = [
    { title: "User Management", description: "Create and manage user accounts", href: "/settings/users", icon: Users },
    { title: "Hospital Profile", description: "Update hospital information and branding", href: "/settings/hospital", icon: Building2 },
    { title: "Roles & Permissions", description: "View role-based access configuration", href: "/settings/roles", icon: Shield },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">System Settings</h1>
            <p className="text-sm text-muted-foreground">Hospital configuration and system preferences.</p>
          </div>
        </div>
      </div>

      {/* Settings Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {settings.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group">
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{s.title}</CardTitle>
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
