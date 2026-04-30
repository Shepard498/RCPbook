import { getUnit } from "../domain/units/unitRegistry";
import type { UnitId } from "../domain/units/unitTypes";
import { formatNumber } from "./numbers";

const basePracticalStep: Record<string, number> = {
  count: 0.01,
  length: 0.1,
  mass: 0.1,
  volume: 0.1,
};

export function formatPracticalAmount(amount: number, unit: UnitId) {
  const decimals = getPracticalFractionDigits(unit);
  const step = 10 ** -decimals;
  const rounded = roundTo(amount, decimals);

  if (amount > 0 && rounded === 0) {
    return `<${formatNumber(step, decimals)} ${unit}`;
  }

  return `${formatNumber(rounded, decimals)} ${unit}`;
}

function getPracticalFractionDigits(unit: UnitId) {
  const definition = getUnit(unit);
  const baseStep = basePracticalStep[definition.dimension] ?? 0.1;
  const decimalPower = Math.log10(definition.toBaseFactor / baseStep);

  return Math.max(0, Math.floor(decimalPower + 0.0000001));
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;

  return Object.is(rounded, -0) ? 0 : rounded;
}
