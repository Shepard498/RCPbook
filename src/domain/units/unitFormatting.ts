import type { UnitId } from "./unitTypes";

export function formatUnit(unit: UnitId) {
  return unit;
}

export function formatPriceUnit(unit: UnitId) {
  return `/${formatUnit(unit)}`;
}
