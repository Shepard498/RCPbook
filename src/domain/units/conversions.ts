import type { Ingredient } from "../ingredients/ingredientTypes";
import { getUnit } from "./unitRegistry";
import type { UnitDimension, UnitId } from "./unitTypes";

export type ConversionResult =
  | {
      ok: true;
      amount: number;
      unit: UnitId;
      warnings: string[];
    }
  | {
      ok: false;
      reason: string;
      warnings: string[];
    };

export interface IngredientConversionInput {
  ingredient: Ingredient;
  amount: number;
  fromUnit: UnitId;
  toUnit: UnitId;
  assumeMissingDensity?: boolean;
}

const assumedDensityWarning = "Missing density; assumed 1 g/mL for cost estimate.";

export function convertUnitAmount(amount: number, fromUnit: UnitId, toUnit: UnitId): ConversionResult {
  if (!isUsableAmount(amount)) {
    return {
      ok: false,
      reason: "Amount must be a positive number.",
      warnings: [],
    };
  }

  const from = getUnit(fromUnit);
  const to = getUnit(toUnit);

  if (from.dimension !== to.dimension) {
    return {
      ok: false,
      reason: `Cannot directly convert ${fromUnit} to ${toUnit}; dimensions differ.`,
      warnings: [],
    };
  }

  return {
    ok: true,
    amount: (amount * from.toBaseFactor) / to.toBaseFactor,
    unit: toUnit,
    warnings: [],
  };
}

export function convertIngredientAmount(input: IngredientConversionInput): ConversionResult {
  const { amount, fromUnit, toUnit, ingredient, assumeMissingDensity = false } = input;

  if (!isUsableAmount(amount)) {
    return {
      ok: false,
      reason: "Amount must be a positive number.",
      warnings: [],
    };
  }

  const from = getUnit(fromUnit);
  const to = getUnit(toUnit);

  if (from.dimension === to.dimension) {
    return convertUnitAmount(amount, fromUnit, toUnit);
  }

  if (from.dimension === "length" || to.dimension === "length") {
    return {
      ok: false,
      reason: "Length units can only be converted to other length units.",
      warnings: [],
    };
  }

  const baseAmount = toBaseCalculationAmount(
    ingredient,
    amount,
    fromUnit,
    to.dimension,
    assumeMissingDensity,
  );

  if (!baseAmount.ok) {
    return baseAmount;
  }

  const targetBaseUnit = to.baseUnit;
  const converted = convertUnitAmount(baseAmount.amount, targetBaseUnit, toUnit);

  if (!converted.ok) {
    return converted;
  }

  return {
    ok: true,
    amount: converted.amount,
    unit: toUnit,
    warnings: baseAmount.warnings,
  };
}

export function getDensityInGramsPerMl(ingredient: Ingredient) {
  if (!ingredient.density || !isUsableAmount(ingredient.density.value)) {
    return null;
  }

  switch (ingredient.density.unit) {
    case "g/mL":
    case "kg/L":
    case "g/cm3":
      return ingredient.density.value;
  }
}

export function getUnitWeightInGrams(ingredient: Ingredient) {
  if (!ingredient.unitWeight || !isUsableAmount(ingredient.unitWeight.value)) {
    return null;
  }

  switch (ingredient.unitWeight.unit) {
    case "g/unit":
      return ingredient.unitWeight.value;
    case "kg/unit":
      return ingredient.unitWeight.value * 1000;
  }
}

export function conversionRequiresDensity(fromUnit: UnitId, toUnit: UnitId) {
  const from = getUnit(fromUnit).dimension;
  const to = getUnit(toUnit).dimension;

  return (
    isMassVolumePair(from, to) ||
    (isCountVolumePair(from, to))
  );
}

export function conversionRequiresUnitWeight(fromUnit: UnitId, toUnit: UnitId) {
  const from = getUnit(fromUnit).dimension;
  const to = getUnit(toUnit).dimension;

  return isCountMassPair(from, to) || isCountVolumePair(from, to);
}

function toBaseCalculationAmount(
  ingredient: Ingredient,
  amount: number,
  fromUnit: UnitId,
  targetDimension: UnitDimension,
  assumeMissingDensity: boolean,
): ConversionResult {
  switch (targetDimension) {
    case "mass":
      return convertToBaseMass(ingredient, amount, fromUnit, assumeMissingDensity);
    case "volume":
      return convertToBaseVolume(ingredient, amount, fromUnit, assumeMissingDensity);
    case "count":
      return convertToBaseCount(ingredient, amount, fromUnit, assumeMissingDensity);
    case "length":
      return {
        ok: false,
        reason: "Ingredient conversions cannot target length units.",
        warnings: [],
      };
  }
}

function convertToBaseMass(
  ingredient: Ingredient,
  amount: number,
  fromUnit: UnitId,
  assumeMissingDensity: boolean,
): ConversionResult {
  const from = getUnit(fromUnit);

  if (from.dimension === "mass") {
    return convertUnitAmount(amount, fromUnit, "g");
  }

  if (from.dimension === "volume") {
    const density = getDensityForConversion(ingredient, assumeMissingDensity);

    if (!density) {
      return {
        ok: false,
        reason: `${ingredient.name} needs density to convert volume to mass.`,
        warnings: ["Missing density"],
      };
    }

    const volumeMl = amount * from.toBaseFactor;
    return {
      ok: true,
      amount: volumeMl * density.value,
      unit: "g",
      warnings: density.warnings,
    };
  }

  if (from.dimension === "count") {
    const unitWeight = getUnitWeightInGrams(ingredient);

    if (!unitWeight) {
      return {
        ok: false,
        reason: `${ingredient.name} needs unit weight to convert count to mass.`,
        warnings: ["Missing unit weight"],
      };
    }

    return {
      ok: true,
      amount: amount * unitWeight,
      unit: "g",
      warnings: [],
    };
  }

  return {
    ok: false,
    reason: "Length units cannot be converted to mass.",
    warnings: [],
  };
}

function convertToBaseVolume(
  ingredient: Ingredient,
  amount: number,
  fromUnit: UnitId,
  assumeMissingDensity: boolean,
): ConversionResult {
  const from = getUnit(fromUnit);

  if (from.dimension === "volume") {
    return convertUnitAmount(amount, fromUnit, "mL");
  }

  const density = getDensityForConversion(ingredient, assumeMissingDensity);
  if (!density) {
    return {
      ok: false,
      reason: `${ingredient.name} needs density to convert to volume.`,
      warnings: ["Missing density"],
    };
  }

  if (from.dimension === "mass") {
    const massGrams = amount * from.toBaseFactor;
    return {
      ok: true,
      amount: massGrams / density.value,
      unit: "mL",
      warnings: density.warnings,
    };
  }

  if (from.dimension === "count") {
    const unitWeight = getUnitWeightInGrams(ingredient);

    if (!unitWeight) {
      return {
        ok: false,
        reason: `${ingredient.name} needs unit weight to convert count to volume.`,
        warnings: ["Missing unit weight"],
      };
    }

    return {
      ok: true,
      amount: (amount * unitWeight) / density.value,
      unit: "mL",
      warnings: density.warnings,
    };
  }

  return {
    ok: false,
    reason: "Length units cannot be converted to volume.",
    warnings: [],
  };
}

function convertToBaseCount(
  ingredient: Ingredient,
  amount: number,
  fromUnit: UnitId,
  assumeMissingDensity: boolean,
): ConversionResult {
  const from = getUnit(fromUnit);

  if (from.dimension === "count") {
    return convertUnitAmount(amount, fromUnit, "unit");
  }

  const unitWeight = getUnitWeightInGrams(ingredient);
  if (!unitWeight) {
    return {
      ok: false,
      reason: `${ingredient.name} needs unit weight to convert to count.`,
      warnings: ["Missing unit weight"],
    };
  }

  if (from.dimension === "mass") {
    const massGrams = amount * from.toBaseFactor;
    return {
      ok: true,
      amount: massGrams / unitWeight,
      unit: "unit",
      warnings: [],
    };
  }

  if (from.dimension === "volume") {
    const density = getDensityForConversion(ingredient, assumeMissingDensity);

    if (!density) {
      return {
        ok: false,
        reason: `${ingredient.name} needs density to convert volume to count.`,
        warnings: ["Missing density"],
      };
    }

    const volumeMl = amount * from.toBaseFactor;
    return {
      ok: true,
      amount: (volumeMl * density.value) / unitWeight,
      unit: "unit",
      warnings: density.warnings,
    };
  }

  return {
    ok: false,
    reason: "Length units cannot be converted to count.",
    warnings: [],
  };
}

function getDensityForConversion(ingredient: Ingredient, assumeMissingDensity: boolean) {
  const density = getDensityInGramsPerMl(ingredient);

  if (density) {
    return {
      value: density,
      warnings: [],
    };
  }

  if (!assumeMissingDensity) {
    return null;
  }

  return {
    value: 1,
    warnings: [assumedDensityWarning],
  };
}

function isUsableAmount(value: number) {
  return Number.isFinite(value) && value > 0;
}

function isMassVolumePair(from: UnitDimension, to: UnitDimension) {
  return (from === "mass" && to === "volume") || (from === "volume" && to === "mass");
}

function isCountMassPair(from: UnitDimension, to: UnitDimension) {
  return (from === "count" && to === "mass") || (from === "mass" && to === "count");
}

function isCountVolumePair(from: UnitDimension, to: UnitDimension) {
  return (from === "count" && to === "volume") || (from === "volume" && to === "count");
}
