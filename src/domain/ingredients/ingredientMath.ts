import type { Ingredient, PurchaseOption } from "./ingredientTypes";
import { getIngredientPriceSummary } from "./priceMath";

export type IngredientWarningBadge =
  | "Missing price"
  | "Old price"
  | "Missing density"
  | "Missing unit weight"
  | "Invalid purchase option";

export function getIngredientWarningBadges(
  ingredient: Ingredient,
  purchaseOptions: PurchaseOption[],
): IngredientWarningBadge[] {
  return getIngredientPriceSummary(ingredient, purchaseOptions).warnings as IngredientWarningBadge[];
}
