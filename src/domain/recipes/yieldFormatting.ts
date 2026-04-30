import { formatNumber } from "../../utils/numbers";
import type { YieldDefinition } from "./yieldTypes";

type Translator = (key: string) => string;

export function formatYield(yieldDefinition: YieldDefinition, t: Translator = (key) => key) {
  switch (yieldDefinition.type) {
    case "count":
      return `${formatNumber(yieldDefinition.amount)} ${yieldDefinition.label || "units"}`;
    case "mass":
      return `${formatNumber(yieldDefinition.amount)} ${yieldDefinition.unit}`;
    case "volume":
      return `${formatNumber(yieldDefinition.amount)} ${yieldDefinition.unit}`;
    case "servings":
      return `${formatNumber(yieldDefinition.amount)} ${yieldDefinition.label || "servings"}`;
    case "moldArea":
      if (yieldDefinition.shape === "circle") {
        return `${t("Round mold")}, ${formatNumber(yieldDefinition.circle?.diameter ?? 0)} ${
          yieldDefinition.circle?.unit ?? "cm"
        } ${t("diameter")}`;
      }

      return `${t("Rectangular mold")}, ${formatNumber(yieldDefinition.rectangle?.width ?? 0)} x ${formatNumber(
        yieldDefinition.rectangle?.length ?? 0,
      )} ${yieldDefinition.rectangle?.unit ?? "cm"}`;
    case "moldVolume":
      if (yieldDefinition.shape === "cylinder") {
        return `${t("Cylinder mold")}, ${formatNumber(yieldDefinition.cylinder?.diameter ?? 0)} x ${formatNumber(
          yieldDefinition.cylinder?.height ?? 0,
        )} ${yieldDefinition.cylinder?.unit ?? "cm"}`;
      }

      return `${t("Box mold")}, ${formatNumber(yieldDefinition.rectangularPrism?.width ?? 0)} x ${formatNumber(
        yieldDefinition.rectangularPrism?.length ?? 0,
      )} x ${formatNumber(yieldDefinition.rectangularPrism?.height ?? 0)} ${
        yieldDefinition.rectangularPrism?.unit ?? "cm"
      }`;
  }
}

export function createDefaultYield(type: YieldDefinition["type"] = "count"): YieldDefinition {
  switch (type) {
    case "count":
      return { type: "count", amount: 1, label: "units" };
    case "mass":
      return { type: "mass", amount: 1000, unit: "g" };
    case "volume":
      return { type: "volume", amount: 1000, unit: "mL" };
    case "servings":
      return { type: "servings", amount: 1, label: "servings" };
    case "moldArea":
      return {
        type: "moldArea",
        shape: "rectangle",
        rectangle: { width: 20, length: 30, unit: "cm" },
      };
    case "moldVolume":
      return {
        type: "moldVolume",
        shape: "rectangularPrism",
        rectangularPrism: { width: 20, length: 30, height: 5, unit: "cm" },
      };
  }
}
