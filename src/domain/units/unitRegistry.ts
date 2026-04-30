import type { UnitDefinition, UnitDimension, UnitId } from "./unitTypes";

export const unitDefinitions: UnitDefinition[] = [
  { id: "mg", label: "milligram", dimension: "mass", toBaseFactor: 0.001, baseUnit: "g" },
  { id: "g", label: "gram", dimension: "mass", toBaseFactor: 1, baseUnit: "g" },
  { id: "kg", label: "kilogram", dimension: "mass", toBaseFactor: 1000, baseUnit: "g" },
  { id: "oz", label: "ounce", dimension: "mass", toBaseFactor: 28.349523125, baseUnit: "g" },
  { id: "lb", label: "pound", dimension: "mass", toBaseFactor: 453.59237, baseUnit: "g" },
  { id: "mL", label: "milliliter", dimension: "volume", toBaseFactor: 1, baseUnit: "mL" },
  { id: "L", label: "liter", dimension: "volume", toBaseFactor: 1000, baseUnit: "mL" },
  { id: "cm3", label: "cubic centimeter", dimension: "volume", toBaseFactor: 1, baseUnit: "mL" },
  { id: "tsp", label: "teaspoon", dimension: "volume", toBaseFactor: 4.92892159375, baseUnit: "mL" },
  { id: "tbsp", label: "tablespoon", dimension: "volume", toBaseFactor: 14.78676478125, baseUnit: "mL" },
  { id: "cup", label: "cup", dimension: "volume", toBaseFactor: 236.5882365, baseUnit: "mL" },
  { id: "unit", label: "unit", dimension: "count", toBaseFactor: 1, baseUnit: "unit" },
  { id: "mm", label: "millimeter", dimension: "length", toBaseFactor: 0.1, baseUnit: "cm" },
  { id: "cm", label: "centimeter", dimension: "length", toBaseFactor: 1, baseUnit: "cm" },
  { id: "m", label: "meter", dimension: "length", toBaseFactor: 100, baseUnit: "cm" },
  { id: "inch", label: "inch", dimension: "length", toBaseFactor: 2.54, baseUnit: "cm" },
];

export const unitRegistry = Object.fromEntries(
  unitDefinitions.map((unit) => [unit.id, unit]),
) as Record<UnitId, UnitDefinition>;

export const unitsByDimension = unitDefinitions.reduce(
  (groups, unit) => {
    groups[unit.dimension].push(unit);
    return groups;
  },
  {
    mass: [],
    volume: [],
    count: [],
    length: [],
  } as Record<UnitDimension, UnitDefinition[]>,
);

export function getUnit(unitId: UnitId) {
  return unitRegistry[unitId];
}

export function getUnitsByDimension(dimension: UnitDimension) {
  return unitsByDimension[dimension];
}

export function getBaseUnitForUnit(unitId: UnitId) {
  return getUnit(unitId).baseUnit;
}

export function getUnitsForDimensions(dimensions?: UnitDimension[]) {
  if (!dimensions || dimensions.length === 0) {
    return unitDefinitions;
  }

  return unitDefinitions.filter((unit) => dimensions.includes(unit.dimension));
}
