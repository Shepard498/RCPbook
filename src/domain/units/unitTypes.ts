export type UnitDimension = "mass" | "volume" | "count" | "length";

export type UnitId =
  | "mg"
  | "g"
  | "kg"
  | "oz"
  | "lb"
  | "mL"
  | "L"
  | "cm3"
  | "tsp"
  | "tbsp"
  | "cup"
  | "unit"
  | "mm"
  | "cm"
  | "m"
  | "inch";

export interface UnitDefinition {
  id: UnitId;
  label: string;
  dimension: UnitDimension;
  toBaseFactor: number;
  baseUnit: UnitId;
}
