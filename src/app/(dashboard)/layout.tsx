"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandPalette } from "@/components/shared/command-palette";
import { cn } from "@/lib/utils";

const COLLAPSED_KEY = "his.sidebar.collapsed";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY);
      if (saved) setCollapsed(saved === "1");
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed, hydrated]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} />
      <div
        className={cn(
          "transition-all duration-300",
          collapsed ? "ml-16" : "ml-64",
        )}
      >
        <Header onToggleSidebar={() => setCollapsed(!collapsed)} />
        <main className="p-4 md:p-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
