import type { Ingredient, PurchaseOption } from "../ingredients/ingredientTypes";
import { getIngredientPriceSummary } from "../ingredients/priceMath";
import type { InventoryItem } from "../inventory/inventoryTypes";
import type { Recipe, RecipeLine } from "../recipes/recipeTypes";
import { calculateScaledRecipeCost } from "../recipes/recipeCosting";
import { scaleRecipe } from "../recipes/scaling";
import { createSubRecipeTargetYield } from "../recipes/subRecipeMath";
import { convertIngredientAmount } from "../units/conversions";
import type { UnitId } from "../units/unitTypes";
import type {
  BatchIngredientTotal,
  BatchIngredientPurchasePlan,
  BatchPlannerItemRow,
  BatchPlannerRecipeResult,
  BatchPlannerRow,
  BatchPlanResult,
} from "./batchPlannerTypes";

export function calculateBatchPlan({
  rows,
  recipes,
  ingredients,
  purchaseOptions,
  inventoryItems = [],
}: {
  rows: BatchPlannerRow[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  purchaseOptions: PurchaseOption[];
  inventoryItems?: InventoryItem[];
}): BatchPlanResult {
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const recipeRows = rows.filter(isRecipeRow);
  const itemRows = rows.filter(isItemRow);
  const recipeResults = recipeRows.map((row) =>
    calculateBatchRecipeResult(row, recipeById, ingredients, purchaseOptions),
  );
  const ingredientTotals = aggregateIngredientTotals(
    recipeResults,
    itemRows,
    ingredientById,
    recipeById,
    purchaseOptions,
    inventoryItems,
  );
  const costSummary = calculateBatchPurchaseCost(ingredientTotals);
  const warnings = Array.from(
    new Set([
      ...recipeResults.flatMap((result) => result.warnings),
      ...ingredientTotals.flatMap((total) => total.warnings),
      ...costSummary.warnings,
    ]),
  );

  return {
    recipeResults,
    ingredientTotals,
    totalCost: costSummary.totalCost,
    currency: costSummary.currency,
    warnings,
  };
}

function calculateBatchRecipeResult(
  row: Extract<BatchPlannerRow, { rowType: "recipe" }>,
  recipeById: Map<string, Recipe>,
  ingredients: Ingredient[],
  purchaseOptions: PurchaseOption[],
): BatchPlannerRecipeResult {
  const recipe = recipeById.get(row.recipeId);

  if (!recipe) {
    return {
      rowId: row.id,
      recipeId: row.recipeId,
      recipeName: "Unknown recipe",
      targetYield: row.targetYield,
      scaledRecipe: null,
      costResult: null,
      warnings: ["Batch row is missing a recipe."],
    };
  }

  const scaledRecipe = scaleRecipe(recipe, row.targetYield);

  if ("ok" in scaledRecipe) {
    return {
      rowId: row.id,
      recipeId: row.recipeId,
      recipeName: recipe.name,
      targetYield: row.targetYield,
      scaledRecipe: null,
      costResult: null,
      warnings: [`${recipe.name}: ${scaledRecipe.reason}`, ...scaledRecipe.warnings],
    };
  }

  const costResult = calculateScaledRecipeCost({
    recipe: scaledRecipe.recipe,
    ingredients,
    purchaseOptions,
    recipes: Array.from(recipeById.values()),
  });

  return {
    rowId: row.id,
    recipeId: row.recipeId,
    recipeName: recipe.name,
    targetYield: row.targetYield,
    scaledRecipe,
    costResult,
    warnings: [
      ...scaledRecipe.warnings.map((warning) => `${recipe.name}: ${warning}`),
      ...costResult.warnings.map((warning) => `${recipe.name}: ${warning}`),
    ],
  };
}

function aggregateIngredientTotals(
  recipeResults: BatchPlannerRecipeResult[],
  itemRows: BatchPlannerItemRow[],
  ingredientById: Map<string, Ingredient>,
  recipeById: Map<string, Recipe>,
  purchaseOptions: PurchaseOption[],
  inventoryItems: InventoryItem[],
) {
  const totals = new Map<string, BatchIngredientTotal>();
  const purchaseOptionsByIngredient = groupPurchaseOptions(purchaseOptions);

  for (const result of recipeResults) {
    if (!result.scaledRecipe) {
      continue;
    }

    aggregateRecipeLinesIntoTotals({
      recipe: result.scaledRecipe.recipe,
      contextName: result.recipeName,
      ingredientById,
      recipeById,
      totals,
      recipePath: [result.recipeId],
    });
  }

  aggregateItemRowsIntoTotals(itemRows, ingredientById, totals);

  return Array.from(totals.values())
    .map((total) => {
      const ingredient = ingredientById.get(total.ingredientId);
      const inventoryResult = ingredient
        ? calculateInventoryAmount(ingredient, inventoryItems)
        : { inventoryAmount: 0, warnings: [] };
      const requiredAmount = Math.max(0, total.amount - inventoryResult.inventoryAmount);
      const requiredCostResult =
        ingredient && requiredAmount > 0
          ? calculateIngredientAmountCost(
              ingredient,
              requiredAmount,
              total.unit,
              purchaseOptionsByIngredient.get(ingredient.id) ?? [],
            )
          : { cost: 0, currency: null, warnings: [] };
      const purchasePlanResult =
        ingredient && requiredAmount > 0
          ? calculatePurchasePlanForTotal(
              ingredient,
              {
                ...total,
                amount: requiredAmount,
              },
              purchaseOptionsByIngredient.get(ingredient.id) ?? [],
            )
          : { purchasePlan: null, warnings: [] };
      const purchaseCostResult =
        purchasePlanResult.purchasePlan && ingredient
          ? calculatePurchasePlanCost(purchasePlanResult.purchasePlan, purchaseOptionsByIngredient.get(ingredient.id) ?? [])
          : { cost: requiredAmount > 0 ? null : 0, currency: null, warnings: [] };

      return {
        ...total,
        inventoryAmount: inventoryResult.inventoryAmount,
        requiredAmount,
        requiredCost: requiredCostResult.cost,
        requiredCostCurrency: requiredCostResult.currency,
        purchaseCost: purchaseCostResult.cost,
        purchaseCostCurrency: purchaseCostResult.currency,
        purchasePlan: purchasePlanResult.purchasePlan,
        warnings: Array.from(
          new Set([
            ...total.warnings,
            ...inventoryResult.warnings,
            ...requiredCostResult.warnings,
            ...purchasePlanResult.warnings,
            ...purchaseCostResult.warnings,
          ]),
        ),
      };
    })
    .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
}

function aggregateRecipeLinesIntoTotals({
  recipe,
  contextName,
  ingredientById,
  recipeById,
  totals,
  recipePath,
}: {
  recipe: Recipe;
  contextName: string;
  ingredientById: Map<string, Ingredient>;
  recipeById: Map<string, Recipe>;
  totals: Map<string, BatchIngredientTotal>;
  recipePath: string[];
}) {
  for (const line of recipe.lines) {
    if (line.itemType === "recipe") {
      aggregateSubRecipeLineIntoTotals({
        line,
        contextName,
        ingredientById,
        recipeById,
        totals,
        recipePath,
      });
      continue;
    }

    const ingredient = line.ingredientId ? ingredientById.get(line.ingredientId) : undefined;

    if (!ingredient) {
      addSyntheticWarning(totals, `A line in ${contextName} is missing an ingredient.`);
      continue;
    }

    const converted = convertIngredientAmount({
      ingredient,
      amount: line.amount,
      fromUnit: line.unit,
      toUnit: ingredient.preferredUnit,
    });

    if (!converted.ok) {
      const existing = getOrCreateIngredientTotal(totals, ingredient);
      existing.warnings.push(`${contextName}: ${converted.reason}`);
      continue;
    }

    const existing = getOrCreateIngredientTotal(totals, ingredient);
    existing.amount += converted.amount;
    existing.warnings.push(...converted.warnings.map((warning) => `${contextName}: ${warning}`));
  }
}

function aggregateSubRecipeLineIntoTotals({
  line,
  contextName,
  ingredientById,
  recipeById,
  totals,
  recipePath,
}: {
  line: RecipeLine;
  contextName: string;
  ingredientById: Map<string, Ingredient>;
  recipeById: Map<string, Recipe>;
  totals: Map<string, BatchIngredientTotal>;
  recipePath: string[];
}) {
  const subRecipe = line.subRecipeId ? recipeById.get(line.subRecipeId) : undefined;

  if (!subRecipe) {
    addSyntheticWarning(totals, `${contextName}: Sub-recipe line is missing a recipe.`);
    return;
  }

  if (recipePath.includes(subRecipe.id)) {
    addSyntheticWarning(totals, `${contextName}: Recipe cannot contain itself through nested sub-recipes.`);
    return;
  }

  const targetYield = createSubRecipeTargetYield(subRecipe, line);

  if (!targetYield.ok) {
    addSyntheticWarning(totals, `${contextName}: ${subRecipe.name}: ${targetYield.reason}`);
    return;
  }

  const scaledSubRecipe = scaleRecipe(subRecipe, targetYield.targetYield);

  if ("ok" in scaledSubRecipe) {
    addSyntheticWarning(totals, `${contextName}: ${subRecipe.name}: ${scaledSubRecipe.reason}`);
    return;
  }

  aggregateRecipeLinesIntoTotals({
    recipe: scaledSubRecipe.recipe,
    contextName: `${contextName} > ${subRecipe.name}`,
    ingredientById,
    recipeById,
    totals,
    recipePath: [...recipePath, subRecipe.id],
  });
}

function aggregateItemRowsIntoTotals(
  itemRows: BatchPlannerItemRow[],
  ingredientById: Map<string, Ingredient>,
  totals: Map<string, BatchIngredientTotal>,
) {
  for (const row of itemRows) {
    const ingredient = ingredientById.get(row.ingredientId);

    if (!ingredient) {
      addSyntheticWarning(totals, "Batch row is missing an item.");
      continue;
    }

    if (!Number.isFinite(row.amount) || row.amount <= 0) {
      const existing = getOrCreateIngredientTotal(totals, ingredient);
      existing.warnings.push(`${ingredient.name}: Item amount must be greater than zero.`);
      continue;
    }

    const converted = convertIngredientAmount({
      ingredient,
      amount: row.amount,
      fromUnit: row.unit,
      toUnit: ingredient.preferredUnit,
    });

    if (!converted.ok) {
      const existing = getOrCreateIngredientTotal(totals, ingredient);
      existing.warnings.push(`${ingredient.name}: ${converted.reason}`);
      continue;
    }

    const existing = getOrCreateIngredientTotal(totals, ingredient);
    existing.amount += converted.amount;
    existing.warnings.push(...converted.warnings.map((warning) => `${ingredient.name}: ${warning}`));
  }
}

function getOrCreateIngredientTotal(totals: Map<string, BatchIngredientTotal>, ingredient: Ingredient) {
  const existing = totals.get(ingredient.id);

  if (existing) {
    return existing;
  }

  const nextTotal: BatchIngredientTotal = {
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    amount: 0,
    unit: ingredient.preferredUnit,
    inventoryAmount: 0,
    requiredAmount: 0,
    requiredCost: null,
    requiredCostCurrency: null,
    purchaseCost: null,
    purchaseCostCurrency: null,
    purchasePlan: null,
    warnings: [],
  };
  totals.set(ingredient.id, nextTotal);
  return nextTotal;
}

function isRecipeRow(row: BatchPlannerRow): row is Extract<BatchPlannerRow, { rowType: "recipe" }> {
  return row.rowType === "recipe";
}

function isItemRow(row: BatchPlannerRow): row is BatchPlannerItemRow {
  return row.rowType === "item";
}

function addSyntheticWarning(totals: Map<string, BatchIngredientTotal>, warning: string) {
  const key = "__warnings";
  const existing = totals.get(key);

  if (existing) {
    existing.warnings.push(warning);
    return;
  }

  totals.set(key, {
    ingredientId: key,
    ingredientName: "Unaggregated items",
    amount: 0,
    unit: "unit",
    inventoryAmount: 0,
    requiredAmount: 0,
    requiredCost: null,
    requiredCostCurrency: null,
    purchaseCost: null,
    purchaseCostCurrency: null,
    purchasePlan: null,
    warnings: [warning],
  });
}

function calculatePurchasePlanForTotal(
  ingredient: Ingredient,
  total: BatchIngredientTotal,
  purchaseOptions: PurchaseOption[],
): { purchasePlan: BatchIngredientPurchasePlan | null; warnings: string[] } {
  if (purchaseOptions.length === 0) {
    return {
      purchasePlan: null,
      warnings: ["Missing purchase option"],
    };
  }

  const evaluations = purchaseOptions.map((option) => evaluatePurchasePlanOption(ingredient, total, option));
  const validEvaluations = evaluations.filter(
    (evaluation): evaluation is PurchasePlanEvaluation & {
      purchasePlan: BatchIngredientPurchasePlan;
      overbuyAmount: number;
    } =>
      Boolean(evaluation.purchasePlan),
  );
  const selectedEvaluation = getClosestPurchasePlan(validEvaluations);

  if (!selectedEvaluation) {
    return {
      purchasePlan: null,
      warnings: Array.from(
        new Set([
          "Invalid purchase option",
          ...evaluations.flatMap((evaluation) => evaluation.warnings),
        ]),
      ),
    };
  }

  return {
    purchasePlan: selectedEvaluation.purchasePlan,
    warnings: selectedEvaluation.warnings,
  };
}

interface PurchasePlanEvaluation {
  option: PurchaseOption;
  purchasePlan: BatchIngredientPurchasePlan | null;
  overbuyAmount: number | null;
  warnings: string[];
}

function evaluatePurchasePlanOption(
  ingredient: Ingredient,
  total: BatchIngredientTotal,
  option: PurchaseOption,
): PurchasePlanEvaluation {
  if (!Number.isFinite(option.amount) || option.amount <= 0) {
    return {
      option,
      purchasePlan: null,
      overbuyAmount: null,
      warnings: ["Purchase option amount must be greater than zero."],
    };
  }

  const convertedNeeded = convertIngredientAmount({
    ingredient,
    amount: total.amount,
    fromUnit: total.unit,
    toUnit: option.unit,
  });

  if (!convertedNeeded.ok) {
    return {
      option,
      purchasePlan: null,
      overbuyAmount: null,
      warnings: [convertedNeeded.reason, ...convertedNeeded.warnings],
    };
  }

  const packageCount = Math.ceil(convertedNeeded.amount / option.amount);
  const purchasedAmount = packageCount * option.amount;
  const convertedPurchased = convertIngredientAmount({
    ingredient,
    amount: purchasedAmount,
    fromUnit: option.unit,
    toUnit: total.unit,
  });

  if (!convertedPurchased.ok) {
    return {
      option,
      purchasePlan: null,
      overbuyAmount: null,
      warnings: [convertedPurchased.reason, ...convertedPurchased.warnings],
    };
  }

  return {
    option,
    purchasePlan: {
      purchaseOptionId: option.id,
      packageCount,
      packageAmount: option.amount,
      packageUnit: option.unit,
      purchasedAmount,
      purchasedUnit: option.unit,
    },
    overbuyAmount: Math.max(0, convertedPurchased.amount - total.amount),
    warnings: convertedNeeded.warnings,
  };
}

function calculateInventoryAmount(ingredient: Ingredient, inventoryItems: InventoryItem[]) {
  const relevantItems = inventoryItems.filter((item) => item.ingredientId === ingredient.id);
  const warnings: string[] = [];
  let inventoryAmount = 0;

  for (const item of relevantItems) {
    const converted = convertIngredientAmount({
      ingredient,
      amount: item.amount,
      fromUnit: item.unit,
      toUnit: ingredient.preferredUnit,
    });

    if (!converted.ok) {
      warnings.push(`Inventory: ${converted.reason}`, ...converted.warnings);
      continue;
    }

    inventoryAmount += converted.amount;
    warnings.push(...converted.warnings.map((warning) => `Inventory: ${warning}`));
  }

  return {
    inventoryAmount,
    warnings,
  };
}

function calculateIngredientAmountCost(
  ingredient: Ingredient,
  amount: number,
  unit: UnitId,
  purchaseOptions: PurchaseOption[],
) {
  const priceSummary = getIngredientPriceSummary(ingredient, purchaseOptions);

  if (priceSummary.currentPricePerBaseUnit === null || !priceSummary.currency) {
    return {
      cost: null,
      currency: priceSummary.currency,
      warnings: priceSummary.warnings,
    };
  }

  const converted = convertIngredientAmount({
    ingredient,
    amount,
    fromUnit: unit,
    toUnit: priceSummary.baseUnit,
  });

  if (!converted.ok) {
    return {
      cost: null,
      currency: priceSummary.currency,
      warnings: [...priceSummary.warnings, converted.reason, ...converted.warnings],
    };
  }

  return {
    cost: converted.amount * priceSummary.currentPricePerBaseUnit,
    currency: priceSummary.currency,
    warnings: [...priceSummary.warnings, ...converted.warnings],
  };
}

function calculatePurchasePlanCost(
  purchasePlan: BatchIngredientPurchasePlan,
  purchaseOptions: PurchaseOption[],
) {
  const option = purchaseOptions.find((candidate) => candidate.id === purchasePlan.purchaseOptionId);

  if (!option) {
    return {
      cost: null,
      currency: null,
      warnings: ["Missing purchase option"],
    };
  }

  if (!Number.isFinite(option.price) || option.price <= 0) {
    return {
      cost: null,
      currency: option.currency,
      warnings: ["Purchase option price must be greater than zero."],
    };
  }

  return {
    cost: purchasePlan.packageCount * option.price,
    currency: option.currency,
    warnings: [],
  };
}

function calculateBatchPurchaseCost(ingredientTotals: BatchIngredientTotal[]) {
  const purchaseCosts = ingredientTotals.filter((total) => total.purchaseCost !== null);
  const pendingCosts = ingredientTotals.filter((total) => total.requiredAmount > 0 && total.purchaseCost === null);
  const currencies = new Set(purchaseCosts.map((total) => total.purchaseCostCurrency).filter(Boolean));

  if (pendingCosts.length > 0) {
    return {
      totalCost: null,
      currency: currencies.size === 1 ? Array.from(currencies)[0] ?? null : null,
      warnings: ["Batch total cost is incomplete because one or more ingredients cannot be purchased."],
    };
  }

  if (currencies.size > 1) {
    return {
      totalCost: null,
      currency: null,
      warnings: ["Batch uses multiple currencies, so total cost cannot be calculated."],
    };
  }

  return {
    totalCost: purchaseCosts.reduce((sum, total) => sum + (total.purchaseCost ?? 0), 0),
    currency: Array.from(currencies)[0] ?? null,
    warnings: [],
  };
}

function calculateBatchCost(recipeResults: BatchPlannerRecipeResult[]) {
  const costResults = recipeResults
    .map((result) => result.costResult)
    .filter((costResult): costResult is NonNullable<typeof costResult> => Boolean(costResult));
  const warnings: string[] = [];

  if (costResults.length === 0) {
    return {
      totalCost: null,
      currency: null,
      warnings,
    };
  }

  if (costResults.length !== recipeResults.length) {
    warnings.push("Batch total cost is incomplete because one or more rows cannot be costed.");
    return {
      totalCost: null,
      currency: null,
      warnings,
    };
  }

  if (costResults.some((costResult) => costResult.totalCost === null || !costResult.currency)) {
    warnings.push("Batch total cost is incomplete because one or more recipes cannot be fully costed.");
    return {
      totalCost: null,
      currency: null,
      warnings,
    };
  }

  const currencies = new Set(costResults.map((costResult) => costResult.currency));

  if (currencies.size > 1) {
    warnings.push("Batch uses multiple currencies, so total cost cannot be calculated.");
    return {
      totalCost: null,
      currency: null,
      warnings,
    };
  }

  return {
    totalCost: costResults.reduce((sum, costResult) => sum + (costResult.totalCost ?? 0), 0),
    currency: costResults[0]?.currency ?? null,
    warnings,
  };
}

function groupPurchaseOptions(purchaseOptions: PurchaseOption[]) {
  const grouped = new Map<string, PurchaseOption[]>();

  for (const option of purchaseOptions) {
    grouped.set(option.ingredientId, [...(grouped.get(option.ingredientId) ?? []), option]);
  }

  return grouped;
}

function getClosestPurchasePlan<
  T extends {
    option: PurchaseOption;
    purchasePlan: BatchIngredientPurchasePlan;
    overbuyAmount: number;
  },
>(evaluations: T[]) {
  return [...evaluations].sort(
    (a, b) => {
      const overbuyDifference = a.overbuyAmount - b.overbuyAmount;

      if (Math.abs(overbuyDifference) > 0.000001) {
        return overbuyDifference;
      }

      if (Boolean(a.option.isPreferred) !== Boolean(b.option.isPreferred)) {
        return a.option.isPreferred ? -1 : 1;
      }

      const packageDifference = a.purchasePlan.packageCount - b.purchasePlan.packageCount;

      if (packageDifference !== 0) {
        return packageDifference;
      }

      return new Date(b.option.lastUpdated).getTime() - new Date(a.option.lastUpdated).getTime();
    },
  )[0];
}
