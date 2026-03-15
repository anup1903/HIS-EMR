"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, ChevronDown } from "lucide-react";
import { useState } from "react";

const PERMISSIONS: Record<string, string[]> = {
  ADMIN: ["patients", "appointments", "opd", "ipd", "billing", "pharmacy", "laboratory", "radiology", "inventory", "hr", "reports", "settings"],
  DOCTOR: ["patients", "appointments", "opd", "ipd", "billing", "pharmacy", "laboratory", "radiology", "reports"],
  NURSE: ["patients", "appointments", "opd", "ipd", "pharmacy", "laboratory", "radiology"],
  RECEPTIONIST: ["patients", "appointments", "opd", "billing"],
  PHARMACIST: ["patients", "pharmacy", "inventory"],
  LAB_TECHNICIAN: ["patients", "laboratory"],
  RADIOLOGIST: ["patients", "radiology"],
  ACCOUNTANT: ["billing", "reports", "hr", "inventory"],
};

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  const role = (session?.user as { role?: string })?.role || "RECEPTIONIST";
  const allowedModules = PERMISSIONS[role] || [];

  const filteredItems = NAV_ITEMS.filter(
    (item) => item.module === "patients" && item.href === "/dashboard" || allowedModules.includes(item.module)
  );

  const toggleMenu = (title: string) => {
    setOpenMenus((prev) =>
      prev.includes(title)
        ? prev.filter((t) => t !== title)
        : [...prev, title]
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <Building2 className="h-6 w-6 text-primary shrink-0" />
        {!collapsed && (
          <span className="font-bold text-lg text-sidebar-foreground">HIS System</span>
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-4rem)]">
        <nav className="space-y-1 p-2">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isOpen = openMenus.includes(item.title);

            return (
              <div key={item.href}>
                {hasChildren ? (
                  <>
                    <button
                      onClick={() => toggleMenu(item.title)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{item.title}</span>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              isOpen && "rotate-180"
                            )}
                          />
                        </>
                      )}
                    </button>
                    {!collapsed && isOpen && (
                      <div className="ml-4 mt-1 space-y-1 border-l pl-4">
                        {item.children!.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "block rounded-md px-3 py-1.5 text-sm transition-colors",
                              pathname === child.href
                                ? "text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {child.title}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}
