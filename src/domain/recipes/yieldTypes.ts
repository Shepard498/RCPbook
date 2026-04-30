import type { UnitId } from "../units/unitTypes";

export type YieldType =
  | "count"
  | "mass"
  | "volume"
  | "servings"
  | "moldArea"
  | "moldVolume";

export type YieldDefinition =
  | CountYield
  | MassYield
  | VolumeYield
  | ServingsYield
  | MoldAreaYield
  | MoldVolumeYield;

export interface CountYield {
  type: "count";
  amount: number;
  label: string;
}

export interface MassYield {
  type: "mass";
  amount: number;
  unit: UnitId;
}

export interface VolumeYield {
  type: "volume";
  amount: number;
  unit: UnitId;
}

export interface ServingsYield {
  type: "servings";
  amount: number;
  label: string;
}

export interface MoldAreaYield {
  type: "moldArea";
  shape: "rectangle" | "circle";
  rectangle?: {
    width: number;
    length: number;
    unit: UnitId;
  };
  circle?: {
    diameter: number;
    unit: UnitId;
  };
}

export interface MoldVolumeYield {
  type: "moldVolume";
  shape: "rectangularPrism" | "cylinder";
  rectangularPrism?: {
    width: number;
    length: number;
    height: number;
    unit: UnitId;
  };
  cylinder?: {
    diameter: number;
    height: number;
    unit: UnitId;
  };
}
