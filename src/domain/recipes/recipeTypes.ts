import type { UnitId } from "../units/unitTypes";
import type { YieldDefinition } from "./yieldTypes";

export type RecipeLineItemType = "ingredient" | "recipe";

export interface RecipeLine {
  id: string;
  itemType: RecipeLineItemType;
  ingredientId?: string;
  subRecipeId?: string;
  amount: number;
  unit: UnitId;
  notes?: string;
  sortOrder: number;
}

export interface ProcedureStep {
  id: string;
  recipeId: string;
  sortOrder: number;
  text: string;
  imageBlobId?: string;
  timeMinutes?: number;
  time?: {
    value: number;
    unit: "min" | "h";
  };
  temperature?: {
    value: number;
    unit: "C" | "F";
  };
  notes?: string;
}

export interface Recipe {
  id: string;
  name: string;
  categoryId?: string;
  description?: string;
  notes?: string;
  yield: YieldDefinition;
  isSubRecipe: boolean;
  lines: RecipeLine[];
  procedureSteps: ProcedureStep[];
  createdAt: string;
  updatedAt: string;
}
