"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials, cn } from "@/lib/utils";
import { Bell, LogOut, Menu, Moon, Settings, Sun, User, Search } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface HeaderProps {
  onToggleSidebar: () => void;
}

/** Humanize a URL path segment for breadcrumbs. */
function humanize(segment: string) {
  if (!segment) return "";
  if (/^[a-z0-9]{20,}$/i.test(segment)) return "Detail";
  return segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { data: session } = useSession();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const pathname = usePathname();

  // Avoid theme hydration flash
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const user = session?.user;
  const role = (user as { role?: string })?.role || "";

  const crumbs = pathname
    .split("/")
    .filter(Boolean)
    .map((seg, idx, arr) => ({
      label: humanize(seg),
      href: "/" + arr.slice(0, idx + 1).join("/"),
    }));

  const isDark = mounted && (resolvedTheme ?? theme) === "dark";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b glass-card px-4 md:px-6 no-print">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        className="shrink-0"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Breadcrumbs (desktop) */}
      <nav className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
        {crumbs.length === 0 && <span className="truncate">Home</span>}
        {crumbs.map((c, i) => (
          <div key={c.href} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <span className="text-muted-foreground/50">/</span>}
            <Link
              href={c.href}
              className={cn(
                "truncate hover:text-foreground transition-colors",
                i === crumbs.length - 1 && "text-foreground font-medium",
              )}
            >
              {c.label}
            </Link>
          </div>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Command palette trigger */}
      <button
        type="button"
        onClick={() => {
          // Synthesize a ⌘K keydown so CommandPalette opens
          const event = new KeyboardEvent("keydown", {
            key: "k",
            metaKey: true,
            ctrlKey: true,
            bubbles: true,
          });
          document.dispatchEvent(event);
        }}
        className="group hidden sm:flex items-center gap-2 h-9 w-64 lg:w-80 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        <Search className="h-4 w-4 opacity-60" />
        <span className="flex-1 text-left">Search patients, modules, actions…</span>
        <kbd>⌘K</kbd>
      </button>

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        {mounted && isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      {/* Notifications */}
      <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
        <Bell className="h-4 w-4" />
        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
          3
        </span>
      </Button>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                {user?.name ? getInitials(user.name) : "U"}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user?.name}</p>
              <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              <p className="text-xs leading-none text-muted-foreground capitalize">
                {role.replace("_", " ").toLowerCase()}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/users">
              <User className="mr-2 h-4 w-4" />
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
