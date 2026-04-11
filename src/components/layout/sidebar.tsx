"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { filterNavByRole, type NavLink } from "@/lib/constants/nav-groups";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, ChevronDown, Pin, PinOff, Star } from "lucide-react";
import type { Role } from "@prisma/client";

interface SidebarProps {
  collapsed?: boolean;
}

const STORAGE_KEYS = {
  pinned: "his.sidebar.pinned",
  closed: "his.sidebar.closedGroups",
};

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = ((session?.user as { role?: Role })?.role ?? "RECEPTIONIST") as Role;

  const groups = useMemo(() => filterNavByRole(role), [role]);

  const [pinned, setPinned] = useState<string[]>([]);
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(STORAGE_KEYS.pinned) || "[]");
      const c = JSON.parse(localStorage.getItem(STORAGE_KEYS.closed) || "[]");
      if (Array.isArray(p)) setPinned(p);
      if (Array.isArray(c)) setClosedGroups(c);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEYS.pinned, JSON.stringify(pinned));
  }, [pinned, hydrated]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEYS.closed, JSON.stringify(closedGroups));
  }, [closedGroups, hydrated]);

  const togglePin = (href: string) => {
    setPinned((prev) => (prev.includes(href) ? prev.filter((p) => p !== href) : [...prev, href]));
  };

  const toggleGroup = (title: string) => {
    setClosedGroups((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    );
  };

  const allItems: NavLink[] = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const pinnedItems = pinned
    .map((href) => allItems.find((i) => i.href === href))
    .filter((i): i is NavLink => Boolean(i));

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Brand — medical hero strip */}
      <div
        className="relative flex h-16 items-center gap-2 overflow-hidden border-b px-4 text-white"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at top left, rgb(20 184 166 / 0.55), transparent 55%), radial-gradient(ellipse at bottom right, rgb(30 58 138 / 0.85), transparent 60%), linear-gradient(135deg, hsl(174 72% 30%) 0%, hsl(196 68% 26%) 45%, hsl(222 55% 14%) 100%)",
        }}
      >
        {/* Hex grid overlay */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="sidebar-hex"
              width="22"
              height="25"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M11 0 L22 6 L22 19 L11 25 L0 19 L0 6 Z"
                fill="none"
                stroke="white"
                strokeWidth="0.7"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#sidebar-hex)" />
        </svg>
        {/* Soft glow bottom-right */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -bottom-10 h-24 w-24 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgb(45 212 191 / 0.4) 0%, transparent 65%)",
          }}
        />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/25 backdrop-blur-sm shrink-0">
          <Building2 className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="relative flex flex-col leading-tight">
            <span className="font-semibold text-sm tracking-tight">HIS System</span>
            <span className="text-[10px] text-teal-200 uppercase tracking-widest">
              Clinical OS
            </span>
          </div>
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-4rem)]">
        <nav className="space-y-4 p-2 pb-16">
          {/* Pinned */}
          {pinnedItems.length > 0 && !collapsed && (
            <NavGroupBlock
              title="Pinned"
              icon={<Star className="h-3 w-3 text-warning" />}
              isClosed={closedGroups.includes("Pinned")}
              onToggle={() => toggleGroup("Pinned")}
            >
              {pinnedItems.map((item) => (
                <NavRow
                  key={"pin-" + item.href}
                  item={item}
                  active={isActive(item.href)}
                  pinned
                  onTogglePin={() => togglePin(item.href)}
                  collapsed={collapsed}
                />
              ))}
            </NavGroupBlock>
          )}

          {/* Groups */}
          {groups.map((group) => {
            const closed = closedGroups.includes(group.title);
            return (
              <NavGroupBlock
                key={group.title}
                title={group.title}
                collapsed={collapsed}
                isClosed={closed}
                onToggle={() => toggleGroup(group.title)}
              >
                {group.items.map((item) => (
                  <NavRow
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    pinned={pinned.includes(item.href)}
                    onTogglePin={() => togglePin(item.href)}
                    collapsed={collapsed}
                  />
                ))}
              </NavGroupBlock>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}

/* ─────── Group block ─────── */
function NavGroupBlock({
  title,
  icon,
  children,
  collapsed,
  isClosed,
  onToggle,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  collapsed?: boolean;
  isClosed: boolean;
  onToggle: () => void;
}) {
  if (collapsed) {
    return <div className="space-y-1">{children}</div>;
  }
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", isClosed && "-rotate-90")}
        />
      </button>
      {!isClosed && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

/* ─────── Single row ─────── */
function NavRow({
  item,
  active,
  pinned,
  onTogglePin,
  collapsed,
}: {
  item: NavLink;
  active: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <div className="group/row relative">
      <Link
        href={item.href}
        title={collapsed ? item.title : undefined}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary/10 text-primary"
            : "text-sidebar-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
        {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
        {active && !collapsed && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
      </Link>
      {!collapsed && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onTogglePin();
          }}
          className={cn(
            "absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/row:opacity-100",
            pinned && "opacity-100 text-warning hover:text-warning",
          )}
          title={pinned ? "Unpin" : "Pin to top"}
        >
          {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
}
