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
} from "lucide-react";
import { type Module } from "./roles";
import { type LucideIcon } from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  module: Module;
  children?: { title: string; href: string }[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    module: "patients",
  },
  {
    title: "Patients",
    href: "/patients",
    icon: Users,
    module: "patients",
    children: [
      { title: "All Patients", href: "/patients" },
      { title: "Register New", href: "/patients/new" },
    ],
  },
  {
    title: "Appointments",
    href: "/appointments",
    icon: Calendar,
    module: "appointments",
  },
  {
    title: "Emergency",
    href: "/emergency",
    icon: Siren,
    module: "patients",
    children: [
      { title: "Active Cases", href: "/emergency" },
      { title: "New Visit", href: "/emergency/new" },
    ],
  },
  {
    title: "OPD",
    href: "/opd",
    icon: Stethoscope,
    module: "opd",
    children: [
      { title: "Queue", href: "/opd/queue" },
      { title: "Consultations", href: "/opd" },
    ],
  },
  {
    title: "IPD",
    href: "/ipd",
    icon: BedDouble,
    module: "ipd",
    children: [
      { title: "Admissions", href: "/ipd" },
      { title: "Bed Management", href: "/ipd/beds" },
      { title: "Nursing Station", href: "/ipd/nursing" },
    ],
  },
  {
    title: "EMR",
    href: "/emr",
    icon: FileHeart,
    module: "patients",
  },
  {
    title: "Operation Theatre",
    href: "/surgery",
    icon: Scissors,
    module: "ipd",
    children: [
      { title: "Schedule", href: "/surgery" },
      { title: "Theatres", href: "/surgery/theatres" },
    ],
  },
  { title: "Billing", href: "/billing", icon: Receipt, module: "billing" },
  {
    title: "Insurance/TPA",
    href: "/insurance",
    icon: Shield,
    module: "billing",
    children: [
      { title: "Claims", href: "/insurance" },
      { title: "Providers", href: "/insurance/providers" },
      { title: "Policies", href: "/insurance/policies" },
    ],
  },
  { title: "Pharmacy", href: "/pharmacy", icon: Pill, module: "pharmacy" },
  {
    title: "Laboratory",
    href: "/laboratory",
    icon: FlaskConical,
    module: "laboratory",
  },
  {
    title: "Radiology",
    href: "/radiology",
    icon: ScanLine,
    module: "radiology",
  },
  {
    title: "Blood Bank",
    href: "/blood-bank",
    icon: Droplets,
    module: "laboratory",
    children: [
      { title: "Inventory", href: "/blood-bank" },
      { title: "Donors", href: "/blood-bank/donors" },
      { title: "Requests", href: "/blood-bank/requests" },
    ],
  },
  {
    title: "Queue Display",
    href: "/queue",
    icon: ListOrdered,
    module: "appointments",
  },
  {
    title: "Telemedicine",
    href: "/telemedicine",
    icon: Video,
    module: "appointments",
  },
  {
    title: "Physiotherapy",
    href: "/physiotherapy",
    icon: Dumbbell,
    module: "opd",
  },
  {
    title: "Dietary",
    href: "/dietary",
    icon: UtensilsCrossed,
    module: "ipd",
  },
  {
    title: "CSSD",
    href: "/cssd",
    icon: SprayCan,
    module: "inventory",
  },
  {
    title: "Ambulance",
    href: "/ambulance",
    icon: Ambulance,
    module: "patients",
  },
  {
    title: "Documents",
    href: "/documents",
    icon: FileText,
    module: "patients",
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Package,
    module: "inventory",
  },
  {
    title: "HR & Payroll",
    href: "/hr",
    icon: Building2,
    module: "hr",
    children: [
      { title: "Employees", href: "/hr/employees" },
      { title: "Departments", href: "/hr/departments" },
      { title: "Attendance", href: "/hr/attendance" },
      { title: "Leave", href: "/hr/leave" },
      { title: "Payroll", href: "/hr/payroll" },
    ],
  },
  {
    title: "MIS Analytics",
    href: "/analytics",
    icon: Activity,
    module: "reports",
  },
  { title: "Reports", href: "/reports", icon: BarChart3, module: "reports" },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    module: "settings",
  },
];
