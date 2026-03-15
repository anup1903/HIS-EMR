"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuickAction {
  label: string;
  href: string;
}

function QuickActionsGrid({ actions }: { actions: QuickAction[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className="flex items-center justify-center rounded-lg border border-dashed p-3 text-sm font-medium hover:border-primary hover:text-primary transition-colors">
              {action.label}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DoctorQuickActions() {
  return (
    <QuickActionsGrid actions={[
      { label: "My Consultations", href: "/opd" },
      { label: "My Appointments", href: "/appointments" },
      { label: "Patient Search", href: "/patients" },
      { label: "Lab Results", href: "/laboratory" },
      { label: "Write Prescription", href: "/opd/consultations/new" },
      { label: "Radiology Orders", href: "/radiology" },
    ]} />
  );
}

export function NurseQuickActions() {
  return (
    <QuickActionsGrid actions={[
      { label: "Patient Queue", href: "/opd" },
      { label: "Record Vitals", href: "/opd/consultations/new" },
      { label: "IPD Patients", href: "/ipd" },
      { label: "Patient Search", href: "/patients" },
    ]} />
  );
}

export function ReceptionistQuickActions() {
  return (
    <QuickActionsGrid actions={[
      { label: "Register Patient", href: "/patients/new" },
      { label: "Book Appointment", href: "/appointments/new" },
      { label: "Patient Search", href: "/patients" },
      { label: "Today's Appointments", href: "/appointments" },
      { label: "Create Invoice", href: "/billing/new" },
      { label: "Patient Check-in", href: "/appointments" },
    ]} />
  );
}

export function PharmacistQuickActions() {
  return (
    <QuickActionsGrid actions={[
      { label: "Pending Prescriptions", href: "/pharmacy" },
      { label: "Drug Inventory", href: "/pharmacy" },
      { label: "Add Drug", href: "/pharmacy/drugs/new" },
      { label: "Low Stock Items", href: "/pharmacy" },
    ]} />
  );
}

export function LabTechQuickActions() {
  return (
    <QuickActionsGrid actions={[
      { label: "Pending Orders", href: "/laboratory" },
      { label: "Enter Results", href: "/laboratory" },
      { label: "Test Catalog", href: "/laboratory" },
      { label: "Recent Reports", href: "/laboratory" },
    ]} />
  );
}

export function RadiologistQuickActions() {
  return (
    <QuickActionsGrid actions={[
      { label: "Pending Orders", href: "/radiology" },
      { label: "Enter Report", href: "/radiology" },
      { label: "Modalities", href: "/radiology" },
      { label: "Recent Orders", href: "/radiology" },
    ]} />
  );
}

export function AccountantQuickActions() {
  return (
    <QuickActionsGrid actions={[
      { label: "Invoices", href: "/billing" },
      { label: "Create Invoice", href: "/billing/new" },
      { label: "Financial Report", href: "/reports/financial" },
      { label: "Reports Hub", href: "/reports" },
    ]} />
  );
}

const ROLE_ACTIONS: Record<string, React.FC> = {
  DOCTOR: DoctorQuickActions,
  NURSE: NurseQuickActions,
  RECEPTIONIST: ReceptionistQuickActions,
  PHARMACIST: PharmacistQuickActions,
  LAB_TECHNICIAN: LabTechQuickActions,
  RADIOLOGIST: RadiologistQuickActions,
  ACCOUNTANT: AccountantQuickActions,
};

export function RoleBasedQuickActions({ role }: { role: string }) {
  const Component = ROLE_ACTIONS[role];
  if (!Component) {
    // Admin default
    return (
      <QuickActionsGrid actions={[
        { label: "Register Patient", href: "/patients/new" },
        { label: "Book Appointment", href: "/appointments/new" },
        { label: "New Invoice", href: "/billing/new" },
        { label: "Admit Patient", href: "/ipd/admit" },
        { label: "Manage Users", href: "/settings/users" },
        { label: "Reports", href: "/reports" },
      ]} />
    );
  }
  return <Component />;
}
