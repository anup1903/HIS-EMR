import { Role } from "@prisma/client";

export type Module =
  | "patients"
  | "appointments"
  | "opd"
  | "ipd"
  | "billing"
  | "pharmacy"
  | "laboratory"
  | "radiology"
  | "inventory"
  | "hr"
  | "reports"
  | "settings"
  | "emr"
  | "insurance"
  | "surgery"
  | "emergency"
  | "blood_bank"
  | "queue"
  | "telemedicine"
  | "dietary"
  | "cssd"
  | "ambulance"
  | "physiotherapy"
  | "documents";

export type Action = "view" | "create" | "edit" | "delete";

export const PERMISSIONS: Record<Role, Partial<Record<Module, Action[]>>> = {
  ADMIN: {
    patients: ["view", "create", "edit", "delete"],
    appointments: ["view", "create", "edit", "delete"],
    opd: ["view", "create", "edit", "delete"],
    ipd: ["view", "create", "edit", "delete"],
    billing: ["view", "create", "edit", "delete"],
    pharmacy: ["view", "create", "edit", "delete"],
    laboratory: ["view", "create", "edit", "delete"],
    radiology: ["view", "create", "edit", "delete"],
    inventory: ["view", "create", "edit", "delete"],
    hr: ["view", "create", "edit", "delete"],
    reports: ["view"],
    settings: ["view", "create", "edit", "delete"],
    emr: ["view", "create", "edit", "delete"],
    insurance: ["view", "create", "edit", "delete"],
    surgery: ["view", "create", "edit", "delete"],
    emergency: ["view", "create", "edit", "delete"],
    blood_bank: ["view", "create", "edit", "delete"],
    queue: ["view", "create", "edit", "delete"],
    telemedicine: ["view", "create", "edit", "delete"],
    dietary: ["view", "create", "edit", "delete"],
    cssd: ["view", "create", "edit", "delete"],
    ambulance: ["view", "create", "edit", "delete"],
    physiotherapy: ["view", "create", "edit", "delete"],
    documents: ["view", "create", "edit", "delete"],
  },
  DOCTOR: {
    patients: ["view", "create", "edit"],
    appointments: ["view", "edit"],
    opd: ["view", "create", "edit"],
    ipd: ["view", "create", "edit"],
    billing: ["view"],
    pharmacy: ["view"],
    laboratory: ["view", "create"],
    radiology: ["view", "create"],
    reports: ["view"],
    emr: ["view", "create", "edit"],
    insurance: ["view"],
    surgery: ["view", "create", "edit"],
    emergency: ["view", "create", "edit"],
    blood_bank: ["view", "create"],
    telemedicine: ["view", "create", "edit"],
    dietary: ["view", "create"],
    physiotherapy: ["view", "create"],
    documents: ["view", "create"],
  },
  NURSE: {
    patients: ["view", "edit"],
    appointments: ["view"],
    opd: ["view", "edit"],
    ipd: ["view", "edit"],
    pharmacy: ["view"],
    laboratory: ["view"],
    radiology: ["view"],
    emr: ["view"],
    emergency: ["view", "edit"],
    blood_bank: ["view"],
    queue: ["view"],
    dietary: ["view", "edit"],
    physiotherapy: ["view"],
    documents: ["view"],
  },
  RECEPTIONIST: {
    patients: ["view", "create", "edit"],
    appointments: ["view", "create", "edit", "delete"],
    opd: ["view"],
    billing: ["view", "create", "edit"],
    insurance: ["view", "create"],
    queue: ["view", "create", "edit"],
    emergency: ["view", "create"],
    documents: ["view", "create"],
  },
  PHARMACIST: {
    patients: ["view"],
    pharmacy: ["view", "create", "edit"],
    inventory: ["view", "edit"],
  },
  LAB_TECHNICIAN: {
    patients: ["view"],
    laboratory: ["view", "create", "edit"],
    blood_bank: ["view", "create", "edit"],
  },
  RADIOLOGIST: {
    patients: ["view"],
    radiology: ["view", "create", "edit"],
  },
  ACCOUNTANT: {
    billing: ["view", "create", "edit"],
    insurance: ["view", "create", "edit"],
    reports: ["view"],
    hr: ["view"],
    inventory: ["view"],
  },
};

export function hasPermission(
  role: Role,
  module: Module,
  action: Action
): boolean {
  return PERMISSIONS[role]?.[module]?.includes(action) ?? false;
}
