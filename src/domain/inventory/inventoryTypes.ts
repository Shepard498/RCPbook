import type { UnitId } from "../units/unitTypes";

export interface InventoryItem {
  id: string;
  ingredientId: string;
  amount: number;
  unit: UnitId;
  location?: string;
  expirationDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
