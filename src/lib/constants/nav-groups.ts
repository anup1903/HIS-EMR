import {
  Users,
  Calendar,
  Stethoscope,
  BedDouble,
  Receipt,
  Pill,
  FlaskConical,
  ScanLine,
  Package,
  Building2,
  BarChart3,
  Settings,
  LayoutDashboard,
  FileHeart,
  Shield,
  Scissors,
  Siren,
  Activity,
  Droplets,
  ListOrdered,
  Video,
  UtensilsCrossed,
  SprayCan,
  Ambulance,
  Dumbbell,
  FileText,
  Sparkles,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { type Role } from "@prisma/client";

export interface NavLink {
  title: string;
  href: string;
  icon: LucideIcon;
  roles?: Role[]; // if omitted, all roles may see it
  badgeKey?: string; // future: wire counts from API (e.g. "inbox.results")
  description?: string; // for the ⌘K palette
  keywords?: string[]; // ⌘K fuzzy keywords
}

export interface NavGroup {
  title: string;
  items: NavLink[];
}

const ALL_CLINICAL: Role[] = ["ADMIN", "DOCTOR", "NURSE"];
const FRONT_DESK: Role[] = ["ADMIN", "RECEPTIONIST"];
const ADMIN_ONLY: Role[] = ["ADMIN"];

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "My Day",
    items: [
      {
        title: "Today",
        href: "/dashboard",
        icon: Sparkles,
        description: "Your role-based home — what needs your attention right now",
        keywords: ["home", "today", "dashboard", "my day"],
      },
      {
        title: "Inbox",
        href: "/dashboard?view=inbox",
        icon: Inbox,
        description: "Results, approvals, and messages waiting on you",
        keywords: ["inbox", "approvals", "messages", "notifications"],
      },
    ],
  },
  {
    title: "Clinical",
    items: [
      {
        title: "Patients",
        href: "/patients",
        icon: Users,
        roles: [...ALL_CLINICAL, "RECEPTIONIST"],
        description: "Search, register, and open patient records",
        keywords: ["patient", "mrn", "register", "record"],
      },
      {
        title: "Appointments",
        href: "/appointments",
        icon: Calendar,
        roles: [...ALL_CLINICAL, "RECEPTIONIST"],
        description: "Book, reschedule, and view today's schedule",
        keywords: ["appointment", "booking", "schedule", "slot"],
      },
      {
        title: "OPD",
        href: "/opd",
        icon: Stethoscope,
        roles: ALL_CLINICAL,
        description: "Outpatient consultations and queue",
        keywords: ["opd", "consultation", "outpatient", "queue"],
      },
      {
        title: "IPD",
        href: "/ipd",
        icon: BedDouble,
        roles: ALL_CLINICAL,
        description: "Admissions, wards, beds, nursing",
        keywords: ["ipd", "ward", "bed", "admit", "inpatient"],
      },
      {
        title: "EMR",
        href: "/emr",
        icon: FileHeart,
        roles: ALL_CLINICAL,
        description: "Electronic medical records and history",
        keywords: ["emr", "history", "notes", "chart"],
      },
      {
        title: "Emergency",
        href: "/emergency",
        icon: Siren,
        roles: [...ALL_CLINICAL, "RECEPTIONIST"],
        description: "ER triage and active cases",
        keywords: ["emergency", "er", "triage"],
      },
      {
        title: "Operation Theatre",
        href: "/surgery",
        icon: Scissors,
        roles: ALL_CLINICAL,
        description: "OT schedule and surgery checklist",
        keywords: ["surgery", "ot", "operation", "theatre"],
      },
      {
        title: "Telemedicine",
        href: "/telemedicine",
        icon: Video,
        roles: ALL_CLINICAL,
        description: "Virtual consultations",
        keywords: ["telemedicine", "video", "virtual"],
      },
      {
        title: "Physiotherapy",
        href: "/physiotherapy",
        icon: Dumbbell,
        roles: ALL_CLINICAL,
        description: "Treatment plans and sessions",
        keywords: ["physio", "physiotherapy", "rehab"],
      },
    ],
  },
  {
    title: "Diagnostics",
    items: [
      {
        title: "Laboratory",
        href: "/laboratory",
        icon: FlaskConical,
        roles: [...ALL_CLINICAL, "LAB_TECHNICIAN"],
        description: "Lab orders, results, worklist",
        keywords: ["lab", "laboratory", "test", "result"],
      },
      {
        title: "Radiology",
        href: "/radiology",
        icon: ScanLine,
        roles: [...ALL_CLINICAL, "RADIOLOGIST"],
        description: "Imaging orders and reports",
        keywords: ["radiology", "xray", "ct", "mri", "imaging"],
      },
      {
        title: "Blood Bank",
        href: "/blood-bank",
        icon: Droplets,
        roles: [...ALL_CLINICAL, "LAB_TECHNICIAN"],
        description: "Donors, inventory, requests",
        keywords: ["blood", "donor", "transfusion"],
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        title: "Pharmacy",
        href: "/pharmacy",
        icon: Pill,
        roles: [...ALL_CLINICAL, "PHARMACIST"],
        description: "Dispense queue, drugs, stock",
        keywords: ["pharmacy", "drug", "medicine", "dispense"],
      },
      {
        title: "Billing",
        href: "/billing",
        icon: Receipt,
        roles: ["ADMIN", "RECEPTIONIST", "ACCOUNTANT"],
        description: "Invoices, packages, payments",
        keywords: ["billing", "invoice", "payment", "bill"],
      },
      {
        title: "Insurance / TPA",
        href: "/insurance",
        icon: Shield,
        roles: ["ADMIN", "RECEPTIONIST", "ACCOUNTANT"],
        description: "Claims, providers, policies",
        keywords: ["insurance", "tpa", "claim", "policy"],
      },
      {
        title: "Inventory",
        href: "/inventory",
        icon: Package,
        roles: ["ADMIN", "PHARMACIST", "ACCOUNTANT"],
        description: "Items, stock, purchase orders",
        keywords: ["inventory", "stock", "store"],
      },
      {
        title: "Ambulance",
        href: "/ambulance",
        icon: Ambulance,
        roles: [...FRONT_DESK, "NURSE", "DOCTOR"],
        description: "Fleet, dispatch, active runs",
        keywords: ["ambulance", "dispatch", "fleet"],
      },
      {
        title: "Dietary",
        href: "/dietary",
        icon: UtensilsCrossed,
        roles: [...ALL_CLINICAL],
        description: "Diet plans and meals",
        keywords: ["diet", "dietary", "food", "meal"],
      },
      {
        title: "CSSD",
        href: "/cssd",
        icon: SprayCan,
        roles: ["ADMIN", "NURSE"],
        description: "Sterilization batches and instruments",
        keywords: ["cssd", "sterilization", "autoclave"],
      },
      {
        title: "Queue Display",
        href: "/queue",
        icon: ListOrdered,
        roles: [...FRONT_DESK, "NURSE", "DOCTOR"],
        description: "Live queue and token board",
        keywords: ["queue", "token", "waiting"],
      },
    ],
  },
  {
    title: "Back-office",
    items: [
      {
        title: "HR & Payroll",
        href: "/hr",
        icon: Building2,
        roles: ["ADMIN", "ACCOUNTANT"],
        description: "Employees, attendance, payroll",
        keywords: ["hr", "payroll", "employee", "leave"],
      },
      {
        title: "MIS Analytics",
        href: "/analytics",
        icon: Activity,
        roles: ["ADMIN", "ACCOUNTANT"],
        description: "Trends, KPIs, forecasts",
        keywords: ["analytics", "mis", "kpi"],
      },
      {
        title: "Reports",
        href: "/reports",
        icon: BarChart3,
        roles: ["ADMIN", "ACCOUNTANT", "DOCTOR"],
        description: "Financial, clinical, operational",
        keywords: ["report", "export"],
      },
      {
        title: "Documents",
        href: "/documents",
        icon: FileText,
        roles: [...ALL_CLINICAL, "RECEPTIONIST"],
        description: "Upload, search, categorize",
        keywords: ["document", "file", "upload"],
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        roles: ADMIN_ONLY,
        description: "Users, roles, hospital, configuration",
        keywords: ["settings", "config", "user", "role"],
      },
      {
        title: "Classic Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ADMIN_ONLY,
        description: "Legacy KPI grid",
        keywords: ["dashboard", "legacy"],
      },
    ],
  },
];

/** Filter groups by role; drop empty groups. */
export function filterNavByRole(role: Role | undefined): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.roles || (role && i.roles.includes(role))),
  })).filter((g) => g.items.length > 0);
}

/** Flatten all items for the ⌘K palette. */
export function flattenNav(role: Role | undefined): NavLink[] {
  return filterNavByRole(role).flatMap((g) => g.items);
}
