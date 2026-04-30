import { convertUnitAmount } from "../units/conversions";
import type { UnitId } from "../units/unitTypes";
import type { Recipe } from "./recipeTypes";
import type { YieldDefinition } from "./yieldTypes";

export type ScaleFactorResult =
  | {
      ok: true;
      factor: number;
      warnings: string[];
    }
  | {
      ok: false;
      reason: string;
      warnings: string[];
    };

export interface ScaledRecipe {
  originalRecipe: Recipe;
  recipe: Recipe;
  originalYield: YieldDefinition;
  targetYield: YieldDefinition;
  scaleFactor: number;
  warnings: string[];
}

export function calculateScaleFactor({
  originalYield,
  targetYield,
}: {
  originalYield: YieldDefinition;
  targetYield: YieldDefinition;
}): ScaleFactorResult {
  if (originalYield.type !== targetYield.type) {
    return {
      ok: false,
      reason: "Target yield must use the same yield type as the original recipe.",
      warnings: [],
    };
  }

  const warnings: string[] = [];

  if (originalYield.type === "servings") {
    warnings.push("Servings scaling is approximate.");
  }

  const originalValue = getComparableYieldValue(originalYield);
  const targetValue = getComparableYieldValue(targetYield);

  if (!originalValue.ok) {
    return {
      ok: false,
      reason: originalValue.reason,
      warnings,
    };
  }

  if (!targetValue.ok) {
    return {
      ok: false,
      reason: targetValue.reason,
      warnings,
    };
  }

  return {
    ok: true,
    factor: targetValue.value / originalValue.value,
    warnings,
  };
}

export function scaleRecipe(
  recipe: Recipe,
  targetYield: YieldDefinition,
): Extract<ScaleFactorResult, { ok: false }> | ScaledRecipe {
  const scaleFactor = calculateScaleFactor({
    originalYield: recipe.yield,
    targetYield,
  });

  if (!scaleFactor.ok) {
    return scaleFactor;
  }

  const scaledRecipe: Recipe = {
    ...recipe,
    yield: targetYield,
    lines: recipe.lines.map((line) => ({
      ...line,
      amount: line.amount * scaleFactor.factor,
    })),
  };

  return {
    originalRecipe: recipe,
    recipe: scaledRecipe,
    originalYield: recipe.yield,
    targetYield,
    scaleFactor: scaleFactor.factor,
    warnings: scaleFactor.warnings,
  };
}

type ComparableYieldResult =
  | {
      ok: true;
      value: number;
    }
  | {
      ok: false;
      reason: string;
    };

function getComparableYieldValue(yieldDefinition: YieldDefinition): ComparableYieldResult {
  switch (yieldDefinition.type) {
    case "count":
    case "servings":
      return positiveValue(yieldDefinition.amount, "Yield amount must be greater than zero.");
    case "mass":
      return convertYieldUnit(yieldDefinition.amount, yieldDefinition.unit, "g");
    case "volume":
      return convertYieldUnit(yieldDefinition.amount, yieldDefinition.unit, "mL");
    case "moldArea":
      return getMoldArea(yieldDefinition);
    case "moldVolume":
      return getMoldVolume(yieldDefinition);
  }
}

function convertYieldUnit(amount: number, fromUnit: UnitId, toUnit: UnitId): ComparableYieldResult {
  const converted = convertUnitAmount(amount, fromUnit, toUnit);

  if (!converted.ok) {
    return {
      ok: false,
      reason: converted.reason,
    } satisfies ComparableYieldResult;
  }

  return positiveValue(converted.amount, "Yield amount must be greater than zero.");
}

function getMoldArea(yieldDefinition: Extract<YieldDefinition, { type: "moldArea" }>): ComparableYieldResult {
  if (yieldDefinition.shape === "circle") {
    if (!yieldDefinition.circle) {
      return { ok: false, reason: "Round mold yield needs a diameter." };
    }

    const diameter = convertYieldUnit(yieldDefinition.circle.diameter, yieldDefinition.circle.unit, "cm");
    if (!diameter.ok) {
      return diameter;
    }

    return positiveValue(Math.PI * (diameter.value / 2) ** 2, "Mold area must be greater than zero.");
  }

  if (!yieldDefinition.rectangle) {
    return { ok: false, reason: "Rectangular mold yield needs width and length." };
  }

  const width = convertYieldUnit(yieldDefinition.rectangle.width, yieldDefinition.rectangle.unit, "cm");
  const length = convertYieldUnit(yieldDefinition.rectangle.length, yieldDefinition.rectangle.unit, "cm");

  if (!width.ok) {
    return width;
  }

  if (!length.ok) {
    return length;
  }

  return positiveValue(width.value * length.value, "Mold area must be greater than zero.");
}

function getMoldVolume(yieldDefinition: Extract<YieldDefinition, { type: "moldVolume" }>): ComparableYieldResult {
  if (yieldDefinition.shape === "cylinder") {
    if (!yieldDefinition.cylinder) {
      return { ok: false, reason: "Cylinder mold yield needs diameter and height." };
    }

    const diameter = convertYieldUnit(yieldDefinition.cylinder.diameter, yieldDefinition.cylinder.unit, "cm");
    const height = convertYieldUnit(yieldDefinition.cylinder.height, yieldDefinition.cylinder.unit, "cm");

    if (!diameter.ok) {
      return diameter;
    }

    if (!height.ok) {
      return height;
    }

    return positiveValue(Math.PI * (diameter.value / 2) ** 2 * height.value, "Mold volume must be greater than zero.");
  }

  if (!yieldDefinition.rectangularPrism) {
    return { ok: false, reason: "Box mold yield needs width, length, and height." };
  }

  const width = convertYieldUnit(
    yieldDefinition.rectangularPrism.width,
    yieldDefinition.rectangularPrism.unit,
    "cm",
  );
  const length = convertYieldUnit(
    yieldDefinition.rectangularPrism.length,
    yieldDefinition.rectangularPrism.unit,
    "cm",
  );
  const height = convertYieldUnit(
    yieldDefinition.rectangularPrism.height,
    yieldDefinition.rectangularPrism.unit,
    "cm",
  );

  if (!width.ok) {
    return width;
  }

  if (!length.ok) {
    return length;
  }

  if (!height.ok) {
    return height;
  }

  return positiveValue(width.value * length.value * height.value, "Mold volume must be greater than zero.");
}

function positiveValue(value: number, reason: string): ComparableYieldResult {
  if (!Number.isFinite(value) || value <= 0) {
    return {
      ok: false,
      reason,
    };
  }

  return {
    ok: true,
    value,
  };
}
