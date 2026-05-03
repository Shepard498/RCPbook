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
  BatchPurchaseMode,
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
  purchaseMode = "simple",
}: {
  rows: BatchPlannerRow[];
  recipes: Recipe[];
  ingredients: Ingredient[];
  purchaseOptions: PurchaseOption[];
  inventoryItems?: InventoryItem[];
  purchaseMode?: BatchPurchaseMode;
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
    purchaseMode,
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
  purchaseMode: BatchPurchaseMode,
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
              purchaseMode,
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
  purchaseMode: BatchPurchaseMode,
): { purchasePlan: BatchIngredientPurchasePlan | null; warnings: string[] } {
  if (purchaseOptions.length === 0) {
    return {
      purchasePlan: null,
      warnings: ["Missing purchase option"],
    };
  }

  if (purchaseMode === "multiOption") {
    return calculateMultiOptionPurchasePlanForTotal(ingredient, total, purchaseOptions);
  }

  return calculateSimplePurchasePlanForTotal(ingredient, total, purchaseOptions);
}

function calculateSimplePurchasePlanForTotal(
  ingredient: Ingredient,
  total: BatchIngredientTotal,
  purchaseOptions: PurchaseOption[],
): { purchasePlan: BatchIngredientPurchasePlan | null; warnings: string[] } {
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
      lines: [
        {
          purchaseOptionId: option.id,
          packageCount,
          packageAmount: option.amount,
          packageUnit: option.unit,
          purchasedAmount,
          purchasedUnit: option.unit,
        },
      ],
      totalPurchasedAmount: convertedPurchased.amount,
      totalPurchasedUnit: total.unit,
    },
    overbuyAmount: Math.max(0, convertedPurchased.amount - total.amount),
    warnings: convertedNeeded.warnings,
  };
}

interface MultiOptionEvaluation {
  option: PurchaseOption;
  amountInTotalUnit: number;
  weight: number;
  warnings: string[];
}

interface MultiOptionEvaluationResult {
  evaluation: MultiOptionEvaluation | null;
  warnings: string[];
}

interface MultiOptionPlanState {
  amount: number;
  cost: number;
  counts: number[];
  packageCount: number;
}

const multiOptionMaxStateCount = 30000;
const purchaseEpsilon = 0.000001;

function calculateMultiOptionPurchasePlanForTotal(
  ingredient: Ingredient,
  total: BatchIngredientTotal,
  purchaseOptions: PurchaseOption[],
): { purchasePlan: BatchIngredientPurchasePlan | null; warnings: string[] } {
  const evaluations = purchaseOptions.map((option) => evaluateMultiOption(ingredient, total, option));
  const validEvaluations = evaluations
    .filter(
      (result): result is MultiOptionEvaluationResult & { evaluation: MultiOptionEvaluation } =>
        result.evaluation !== null,
    )
    .map((result) => result.evaluation);
  const evaluationWarnings = evaluations.flatMap((evaluation) => evaluation.warnings);

  if (validEvaluations.length === 0) {
    return {
      purchasePlan: null,
      warnings: Array.from(
        new Set([
          "Invalid purchase option",
          ...evaluationWarnings,
        ]),
      ),
    };
  }

  const currencies = new Set(validEvaluations.map((evaluation) => normalizePurchaseCurrency(evaluation.option.currency)));

  if (currencies.size > 1) {
    return {
      purchasePlan: null,
      warnings: ["Purchase options use multiple currencies, so multi-option purchase cannot compare costs."],
    };
  }

  const quantum = getMultiOptionQuantum(
    total.amount,
    validEvaluations.map((evaluation) => evaluation.amountInTotalUnit),
  );
  const targetWeight = Math.ceil(total.amount / quantum);
  const maxWeight =
    targetWeight +
    Math.ceil(Math.max(...validEvaluations.map((evaluation) => evaluation.amountInTotalUnit)) / quantum);
  const optionsWithWeights = validEvaluations
    .map((evaluation) => ({
      ...evaluation,
      weight: Math.max(1, Math.round(evaluation.amountInTotalUnit / quantum)),
    }))
    .sort((a, b) => b.amountInTotalUnit - a.amountInTotalUnit || a.option.price - b.option.price);
  const states = Array<MultiOptionPlanState | null>(maxWeight + 1).fill(null);

  states[0] = {
    amount: 0,
    cost: 0,
    counts: Array(optionsWithWeights.length).fill(0) as number[],
    packageCount: 0,
  };

  for (let weight = 0; weight <= maxWeight; weight += 1) {
    const state = states[weight];

    if (!state) {
      continue;
    }

    optionsWithWeights.forEach((evaluation, index) => {
      const nextWeight = weight + evaluation.weight;

      if (nextWeight > maxWeight) {
        return;
      }

      const counts = [...state.counts];
      counts[index] += 1;

      const nextState: MultiOptionPlanState = {
        amount: state.amount + evaluation.amountInTotalUnit,
        cost: state.cost + evaluation.option.price,
        counts,
        packageCount: state.packageCount + 1,
      };

      if (!states[nextWeight] || comparePlanStateForWeight(nextState, states[nextWeight]!) < 0) {
        states[nextWeight] = nextState;
      }
    });
  }

  const selectedState = states
    .filter((state): state is MultiOptionPlanState => state !== null && state.amount + purchaseEpsilon >= total.amount)
    .sort((a, b) => compareCompletedPlanStates(a, b, total.amount))[0];

  if (!selectedState) {
    return calculateSimplePurchasePlanForTotal(ingredient, total, purchaseOptions);
  }

  const selectedWarnings = new Set<string>();
  const lines = selectedState.counts.flatMap((count, index) => {
    if (count <= 0) {
      return [];
    }

    const evaluation = optionsWithWeights[index];
    evaluation.warnings.forEach((warning) => selectedWarnings.add(warning));

    return [
      {
        purchaseOptionId: evaluation.option.id,
        packageCount: count,
        packageAmount: evaluation.option.amount,
        packageUnit: evaluation.option.unit,
        purchasedAmount: count * evaluation.option.amount,
        purchasedUnit: evaluation.option.unit,
      },
    ];
  });

  return {
    purchasePlan: {
      lines,
      totalPurchasedAmount: selectedState.amount,
      totalPurchasedUnit: total.unit,
    },
    warnings: Array.from(selectedWarnings),
  };
}

function evaluateMultiOption(
  ingredient: Ingredient,
  total: BatchIngredientTotal,
  option: PurchaseOption,
): MultiOptionEvaluationResult {
  const warnings: string[] = [];

  if (!Number.isFinite(option.amount) || option.amount <= 0) {
    warnings.push("Purchase option amount must be greater than zero.");
    return { evaluation: null, warnings };
  }

  if (!Number.isFinite(option.price) || option.price <= 0) {
    warnings.push("Purchase option price must be greater than zero.");
    return { evaluation: null, warnings };
  }

  const converted = convertIngredientAmount({
    ingredient,
    amount: option.amount,
    fromUnit: option.unit,
    toUnit: total.unit,
  });

  if (!converted.ok) {
    warnings.push(converted.reason, ...converted.warnings);
    return { evaluation: null, warnings };
  }

  if (converted.amount <= 0) {
    warnings.push("Converted purchase amount must be greater than zero.");
    return { evaluation: null, warnings };
  }

  return {
    evaluation: {
      option,
      amountInTotalUnit: converted.amount,
      weight: 0,
      warnings: converted.warnings,
    },
    warnings: converted.warnings,
  };
}

function getMultiOptionQuantum(targetAmount: number, optionAmounts: number[]) {
  let quantum = 0.001;
  const maxAmount = targetAmount + Math.max(...optionAmounts);

  while (Math.ceil(maxAmount / quantum) > multiOptionMaxStateCount) {
    quantum *= 10;
  }

  return quantum;
}

function comparePlanStateForWeight(a: MultiOptionPlanState, b: MultiOptionPlanState) {
  const costDifference = a.cost - b.cost;

  if (Math.abs(costDifference) > purchaseEpsilon) {
    return costDifference;
  }

  const amountDifference = a.amount - b.amount;

  if (Math.abs(amountDifference) > purchaseEpsilon) {
    return amountDifference;
  }

  return a.packageCount - b.packageCount;
}

function compareCompletedPlanStates(a: MultiOptionPlanState, b: MultiOptionPlanState, targetAmount: number) {
  const overbuyDifference = Math.max(0, a.amount - targetAmount) - Math.max(0, b.amount - targetAmount);

  if (Math.abs(overbuyDifference) > purchaseEpsilon) {
    return overbuyDifference;
  }

  const costDifference = a.cost - b.cost;

  if (Math.abs(costDifference) > purchaseEpsilon) {
    return costDifference;
  }

  return a.packageCount - b.packageCount;
}

function normalizePurchaseCurrency(currency: string) {
  return currency.trim() || "$";
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
  let cost = 0;
  let currency: string | null = null;
  const warnings = new Set<string>();

  for (const line of purchasePlan.lines) {
    const option = purchaseOptions.find((candidate) => candidate.id === line.purchaseOptionId);

    if (!option) {
      warnings.add("Missing purchase option");
      continue;
    }

    const optionCurrency = normalizePurchaseCurrency(option.currency);

    if (currency && optionCurrency !== currency) {
      warnings.add("Batch uses multiple currencies, so total cost cannot be calculated.");
      continue;
    }

    currency = optionCurrency;

    if (!Number.isFinite(option.price) || option.price <= 0) {
      warnings.add("Purchase option price must be greater than zero.");
      continue;
    }

    cost += line.packageCount * option.price;
  }

  if (warnings.size > 0) {
    return {
      cost: null,
      currency,
      warnings: Array.from(warnings),
    };
  }

  return {
    cost,
    currency,
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

      const packageDifference = getPurchasePlanPackageCount(a.purchasePlan) - getPurchasePlanPackageCount(b.purchasePlan);

      if (packageDifference !== 0) {
        return packageDifference;
      }

      return new Date(b.option.lastUpdated).getTime() - new Date(a.option.lastUpdated).getTime();
    },
  )[0];
}

function getPurchasePlanPackageCount(purchasePlan: BatchIngredientPurchasePlan) {
  return purchasePlan.lines.reduce((sum, line) => sum + line.packageCount, 0);
}
