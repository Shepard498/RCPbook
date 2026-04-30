import type { UnitId } from "../units/unitTypes";

export type DensityUnit = "g/mL" | "kg/L" | "g/cm3";
export type UnitWeightUnit = "g/unit" | "kg/unit";

export interface Ingredient {
  id: string;
  name: string;
  categoryId?: string;
  preferredUnit: UnitId;
  density?: {
    value: number;
    unit: DensityUnit;
  };
  unitWeight?: {
    value: number;
    unit: UnitWeightUnit;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IngredientCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface PurchaseOption {
  id: string;
  ingredientId: string;
  amount: number;
  unit: UnitId;
  price: number;
  currency: string;
  lastUpdated: string;
  referenceUrl?: string;
  supplier?: string;
  brand?: string;
  notes?: string;
  isPreferred?: boolean;
  createdAt: string;
  updatedAt: string;
}
