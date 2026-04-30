import type { UnitId } from "../units/unitTypes";
import type { YieldDefinition } from "../recipes/yieldTypes";
import type { CostResult } from "../recipes/recipeCosting";
import type { ScaledRecipe } from "../recipes/scaling";

export type BatchPlannerRow = BatchPlannerRecipeRow | BatchPlannerItemRow;

export interface BatchPlannerRecipeRow {
  id: string;
  rowType: "recipe";
  recipeId: string;
  targetYield: YieldDefinition;
}

export interface BatchPlannerItemRow {
  id: string;
  rowType: "item";
  ingredientId: string;
  amount: number;
  unit: UnitId;
}

export interface BatchPlannerRecipeResult {
  rowId: string;
  recipeId: string;
  recipeName: string;
  targetYield: YieldDefinition;
  scaledRecipe: ScaledRecipe | null;
  costResult: CostResult | null;
  warnings: string[];
}

export interface BatchIngredientTotal {
  ingredientId: string;
  ingredientName: string;
  amount: number;
  unit: UnitId;
  inventoryAmount: number;
  requiredAmount: number;
  requiredCost: number | null;
  requiredCostCurrency: string | null;
  purchaseCost: number | null;
  purchaseCostCurrency: string | null;
  purchasePlan: BatchIngredientPurchasePlan | null;
  warnings: string[];
}

export interface BatchIngredientPurchasePlan {
  purchaseOptionId: string;
  packageCount: number;
  packageAmount: number;
  packageUnit: UnitId;
  purchasedAmount: number;
  purchasedUnit: UnitId;
}

export interface BatchPlanResult {
  recipeResults: BatchPlannerRecipeResult[];
  ingredientTotals: BatchIngredientTotal[];
  totalCost: number | null;
  currency: string | null;
  warnings: string[];
}
