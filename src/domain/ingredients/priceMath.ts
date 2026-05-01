import { isOlderThanDays } from "../../utils/dates";
import { formatCurrency, normalizeCurrency } from "../../utils/numbers";
import {
  conversionRequiresDensity,
  conversionRequiresUnitWeight,
  convertIngredientAmount,
} from "../units/conversions";
import { getBaseUnitForUnit } from "../units/unitRegistry";
import type { UnitId } from "../units/unitTypes";
import type { Ingredient, PurchaseOption } from "./ingredientTypes";

export interface PricePerBaseUnitResult {
  ok: boolean;
  pricePerBaseUnit: number | null;
  baseUnit: UnitId;
  currency: string | null;
  purchaseOptionId: string;
  reason?: string;
  warnings: string[];
}

export interface IngredientPriceSummary {
  currentPricePerBaseUnit: number | null;
  baseUnit: UnitId;
  currency: string | null;
  lastUpdated: string | null;
  purchaseOption: PurchaseOption | null;
  invalidOptionCount: number;
  warnings: string[];
}

export interface PriceCalculationOptions {
  assumeMissingDensity?: boolean;
}

const stalePriceDays = 90;

export function getIngredientBaseUnit(ingredient: Ingredient) {
  return getBaseUnitForUnit(ingredient.preferredUnit);
}

export function calculatePricePerBaseUnit(
  ingredient: Ingredient,
  purchaseOption: PurchaseOption,
  options: PriceCalculationOptions = {},
): PricePerBaseUnitResult {
  const baseUnit = getIngredientBaseUnit(ingredient);

  if (!Number.isFinite(purchaseOption.amount) || purchaseOption.amount <= 0) {
    return invalidPriceResult(
      purchaseOption,
      baseUnit,
      "Purchase option amount must be greater than zero.",
    );
  }

  if (!Number.isFinite(purchaseOption.price) || purchaseOption.price <= 0) {
    return invalidPriceResult(
      purchaseOption,
      baseUnit,
      "Purchase option price must be greater than zero.",
    );
  }

  const converted = convertIngredientAmount({
    ingredient,
    amount: purchaseOption.amount,
    fromUnit: purchaseOption.unit,
    toUnit: baseUnit,
    assumeMissingDensity: options.assumeMissingDensity,
  });

  if (!converted.ok) {
    return {
      ok: false,
      pricePerBaseUnit: null,
      baseUnit,
      currency: purchaseOption.currency ? normalizeCurrency(purchaseOption.currency) : null,
      purchaseOptionId: purchaseOption.id,
      reason: converted.reason,
      warnings: converted.warnings,
    };
  }

  if (converted.amount <= 0) {
    return invalidPriceResult(
      purchaseOption,
      baseUnit,
      "Converted purchase amount must be greater than zero.",
    );
  }

  return {
    ok: true,
    pricePerBaseUnit: purchaseOption.price / converted.amount,
    baseUnit,
    currency: normalizeCurrency(purchaseOption.currency),
    purchaseOptionId: purchaseOption.id,
    warnings: converted.warnings,
  };
}

export function getIngredientPriceSummary(
  ingredient: Ingredient,
  purchaseOptions: PurchaseOption[],
  now = new Date(),
  options: PriceCalculationOptions = {},
): IngredientPriceSummary {
  const baseUnit = getIngredientBaseUnit(ingredient);

  if (purchaseOptions.length === 0) {
    return {
      currentPricePerBaseUnit: null,
      baseUnit,
      currency: null,
      lastUpdated: null,
      purchaseOption: null,
      invalidOptionCount: 0,
      warnings: ["Missing price"],
    };
  }

  const evaluations = purchaseOptions.map((option) => ({
    option,
    result: calculatePricePerBaseUnit(ingredient, option, options),
  }));
  const validOptions = evaluations.filter((evaluation) => evaluation.result.ok);
  const invalidOptionCount = evaluations.length - validOptions.length;
  const warnings = new Set<string>();

  if (invalidOptionCount > 0) {
    warnings.add("Invalid purchase option");
  }

  if (evaluations.some((evaluation) => evaluation.result.warnings.some(isMissingDensityWarning))) {
    warnings.add(
      options.assumeMissingDensity
        ? "Missing density; assumed 1 g/mL for cost estimate."
        : "Missing density",
    );
  }

  if (evaluations.some((evaluation) => evaluation.result.warnings.includes("Missing unit weight"))) {
    warnings.add("Missing unit weight");
  }

  if (validOptions.length === 0) {
    warnings.add("Missing price");
    return {
      currentPricePerBaseUnit: null,
      baseUnit,
      currency: null,
      lastUpdated: null,
      purchaseOption: null,
      invalidOptionCount,
      warnings: Array.from(warnings),
    };
  }

  const preferred = validOptions.find((evaluation) => evaluation.option.isPreferred);
  const selected = preferred ?? getMostRecentlyUpdated(validOptions);

  if (isOlderThanDays(selected.option.lastUpdated, stalePriceDays, now)) {
    warnings.add("Old price");
  }

  for (const warning of selected.result.warnings) {
    warnings.add(warning);
  }

  return {
    currentPricePerBaseUnit: selected.result.pricePerBaseUnit,
    baseUnit: selected.result.baseUnit,
    currency: selected.result.currency,
    lastUpdated: selected.option.lastUpdated,
    purchaseOption: selected.option,
    invalidOptionCount,
    warnings: Array.from(warnings),
  };
}

function isMissingDensityWarning(warning: string) {
  return warning.includes("Missing density");
}

export function describePriceSummary(summary: IngredientPriceSummary) {
  if (summary.currentPricePerBaseUnit === null || !summary.currency) {
    return "No usable price";
  }

  return `${formatCurrency(summary.currentPricePerBaseUnit, summary.currency)}/${summary.baseUnit}`;
}

export function purchaseOptionMayNeedDensity(ingredient: Ingredient, option: PurchaseOption) {
  return (
    !ingredient.density &&
    conversionRequiresDensity(option.unit, getIngredientBaseUnit(ingredient))
  );
}

export function purchaseOptionMayNeedUnitWeight(ingredient: Ingredient, option: PurchaseOption) {
  return (
    !ingredient.unitWeight &&
    conversionRequiresUnitWeight(option.unit, getIngredientBaseUnit(ingredient))
  );
}

function invalidPriceResult(
  purchaseOption: PurchaseOption,
  baseUnit: UnitId,
  reason: string,
): PricePerBaseUnitResult {
  return {
    ok: false,
    pricePerBaseUnit: null,
    baseUnit,
    currency: purchaseOption.currency ? normalizeCurrency(purchaseOption.currency) : null,
    purchaseOptionId: purchaseOption.id,
    reason,
    warnings: [],
  };
}

function getMostRecentlyUpdated<T extends { option: PurchaseOption }>(evaluations: T[]) {
  return [...evaluations].sort(
    (a, b) =>
      new Date(b.option.lastUpdated).getTime() - new Date(a.option.lastUpdated).getTime(),
  )[0];
}
