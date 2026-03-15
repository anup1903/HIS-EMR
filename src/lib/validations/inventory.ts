import { z } from "zod";

export const inventoryItemCreateSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  category: z.string().optional(),
  unit: z.string().optional(),
  description: z.string().optional(),
  unitCost: z.number().min(0).optional(),
  currentStock: z.number().min(0).optional(),
  reorderLevel: z.number().min(0).optional(),
});

export const supplierCreateSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  contactPerson: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export type InventoryItemCreateInput = z.infer<typeof inventoryItemCreateSchema>;
export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;
