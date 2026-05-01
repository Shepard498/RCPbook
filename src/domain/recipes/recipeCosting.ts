import type { Ingredient, PurchaseOption } from "../ingredients/ingredientTypes";
import { getIngredientPriceSummary } from "../ingredients/priceMath";
import { convertIngredientAmount } from "../units/conversions";
import type { UnitId } from "../units/unitTypes";
import type { Recipe, RecipeLine } from "./recipeTypes";
import { scaleRecipe } from "./scaling";
import { createSubRecipeTargetYield } from "./subRecipeMath";

export interface RecipeLineCost {
  lineId: string;
  ingredientId?: string;
  subRecipeId?: string;
  ingredientName: string;
  amount: number;
  unit: UnitId;
  cost: number | null;
  currency: string | null;
  warnings: string[];
}

export interface CostResult {
  totalCost: number | null;
  currency: string | null;
  lineCosts: RecipeLineCost[];
  warnings: string[];
}

export function calculateRecipeCost({
  recipe,
  ingredients,
  purchaseOptions,
  recipes = [],
}: {
  recipe: Recipe;
  ingredients: Ingredient[];
  purchaseOptions: PurchaseOption[];
  recipes?: Recipe[];
}): CostResult {
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const recipeById = new Map(recipes.map((availableRecipe) => [availableRecipe.id, availableRecipe]));
  recipeById.set(recipe.id, recipe);
  const purchaseOptionsByIngredient = groupPurchaseOptions(purchaseOptions);
  return calculateRecipeCostInternal(recipe, ingredientById, recipeById, purchaseOptionsByIngredient, []);
}

function calculateRecipeCostInternal(
  recipe: Recipe,
  ingredientById: Map<string, Ingredient>,
  recipeById: Map<string, Recipe>,
  purchaseOptionsByIngredient: Map<string, PurchaseOption[]>,
  recipePath: string[],
): CostResult {
  const lineCosts = recipe.lines.map((line) =>
    calculateRecipeLineCost(line, ingredientById, recipeById, purchaseOptionsByIngredient, [
      ...recipePath,
      recipe.id,
    ]),
  );
  const warnings = lineCosts.flatMap((lineCost) => lineCost.warnings);
  const pricedLines = lineCosts.filter((lineCost) => lineCost.cost !== null);
  const currencies = new Set(pricedLines.map((lineCost) => lineCost.currency).filter(Boolean));

  if (pricedLines.length !== lineCosts.length) {
    return {
      totalCost: null,
      currency: currencies.size === 1 ? Array.from(currencies)[0] ?? null : null,
      lineCosts,
      warnings,
    };
  }

  if (currencies.size > 1) {
    return {
      totalCost: null,
      currency: null,
      lineCosts,
      warnings: [...warnings, "Recipe uses multiple currencies, so total cost cannot be calculated."],
    };
  }

  return {
    totalCost: pricedLines.reduce((sum, lineCost) => sum + (lineCost.cost ?? 0), 0),
    currency: Array.from(currencies)[0] ?? null,
    lineCosts,
    warnings,
  };
}

export function calculateScaledRecipeCost(input: {
  recipe: Recipe;
  ingredients: Ingredient[];
  purchaseOptions: PurchaseOption[];
  recipes?: Recipe[];
}) {
  return calculateRecipeCost(input);
}

function calculateRecipeLineCost(
  line: RecipeLine,
  ingredientById: Map<string, Ingredient>,
  recipeById: Map<string, Recipe>,
  purchaseOptionsByIngredient: Map<string, PurchaseOption[]>,
  recipePath: string[],
): RecipeLineCost {
  if (line.itemType === "recipe") {
    const subRecipe = line.subRecipeId ? recipeById.get(line.subRecipeId) : undefined;

    if (!subRecipe) {
      return {
        lineId: line.id,
        subRecipeId: line.subRecipeId,
        ingredientName: "Sub-recipe",
        amount: line.amount,
        unit: line.unit,
        cost: null,
        currency: null,
        warnings: ["Sub-recipe line is missing a recipe."],
      };
    }

    if (recipePath.includes(subRecipe.id)) {
      return {
        lineId: line.id,
        subRecipeId: subRecipe.id,
        ingredientName: subRecipe.name,
        amount: line.amount,
        unit: line.unit,
        cost: null,
        currency: null,
        warnings: ["Recipe cannot contain itself through nested sub-recipes."],
      };
    }

    const targetYield = createSubRecipeTargetYield(subRecipe, line);

    if (!targetYield.ok) {
      return {
        lineId: line.id,
        subRecipeId: subRecipe.id,
        ingredientName: subRecipe.name,
        amount: line.amount,
        unit: line.unit,
        cost: null,
        currency: null,
        warnings: [`${subRecipe.name}: ${targetYield.reason}`],
      };
    }

    const scaledSubRecipe = scaleRecipe(subRecipe, targetYield.targetYield);

    if ("ok" in scaledSubRecipe) {
      return {
        lineId: line.id,
        subRecipeId: subRecipe.id,
        ingredientName: subRecipe.name,
        amount: line.amount,
        unit: line.unit,
        cost: null,
        currency: null,
        warnings: [`${subRecipe.name}: ${scaledSubRecipe.reason}`, ...targetYield.warnings],
      };
    }

    const subRecipeCost = calculateRecipeCostInternal(
      scaledSubRecipe.recipe,
      ingredientById,
      recipeById,
      purchaseOptionsByIngredient,
      recipePath,
    );

    return {
      lineId: line.id,
      subRecipeId: subRecipe.id,
      ingredientName: subRecipe.name,
      amount: line.amount,
      unit: line.unit,
      cost: subRecipeCost.totalCost,
      currency: subRecipeCost.currency,
      warnings: [
        ...targetYield.warnings,
        ...scaledSubRecipe.warnings,
        ...subRecipeCost.warnings.map((warning) => `${subRecipe.name}: ${warning}`),
      ],
    };
  }

  const ingredient = line.ingredientId ? ingredientById.get(line.ingredientId) : undefined;

  if (!ingredient) {
    return {
      lineId: line.id,
      ingredientId: line.ingredientId,
      ingredientName: "Unknown ingredient",
      amount: line.amount,
      unit: line.unit,
      cost: null,
      currency: null,
      warnings: ["Recipe line is missing an ingredient."],
    };
  }

  const priceSummary = getIngredientPriceSummary(
    ingredient,
    purchaseOptionsByIngredient.get(ingredient.id) ?? [],
    undefined,
    { assumeMissingDensity: true },
  );
  const warnings = priceSummary.warnings.map((warning) => `${ingredient.name}: ${warning}`);

  if (priceSummary.currentPricePerBaseUnit === null || !priceSummary.currency) {
    return {
      lineId: line.id,
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      amount: line.amount,
      unit: line.unit,
      cost: null,
      currency: priceSummary.currency,
      warnings,
    };
  }

  const converted = convertIngredientAmount({
    ingredient,
    amount: line.amount,
    fromUnit: line.unit,
    toUnit: priceSummary.baseUnit,
    assumeMissingDensity: true,
  });

  if (!converted.ok) {
    return {
      lineId: line.id,
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      amount: line.amount,
      unit: line.unit,
      cost: null,
      currency: priceSummary.currency,
      warnings: [...warnings, `${ingredient.name}: ${converted.reason}`],
    };
  }

  return {
    lineId: line.id,
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    amount: line.amount,
    unit: line.unit,
    cost: converted.amount * priceSummary.currentPricePerBaseUnit,
    currency: priceSummary.currency,
    warnings: Array.from(
      new Set([
        ...warnings,
        ...converted.warnings.map((warning) => `${ingredient.name}: ${warning}`),
      ]),
    ),
  };
}

function groupPurchaseOptions(purchaseOptions: PurchaseOption[]) {
  const grouped = new Map<string, PurchaseOption[]>();

  for (const option of purchaseOptions) {
    grouped.set(option.ingredientId, [...(grouped.get(option.ingredientId) ?? []), option]);
  }

  return grouped;
}
