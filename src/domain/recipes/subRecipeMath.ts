import { getUnit } from "../units/unitRegistry";
import type { UnitDimension, UnitId } from "../units/unitTypes";
import type { Recipe, RecipeLine } from "./recipeTypes";
import type { YieldDefinition } from "./yieldTypes";

export type SubRecipeTargetYieldResult =
  | {
      ok: true;
      targetYield: YieldDefinition;
      warnings: string[];
    }
  | {
      ok: false;
      reason: string;
      warnings: string[];
    };

export function createSubRecipeTargetYield(
  subRecipe: Recipe,
  line: RecipeLine,
): SubRecipeTargetYieldResult {
  if (!Number.isFinite(line.amount) || line.amount <= 0) {
    return {
      ok: false,
      reason: "Sub-recipe line amount must be greater than zero.",
      warnings: [],
    };
  }

  switch (subRecipe.yield.type) {
    case "count":
      if (line.unit !== "unit") {
        return invalidUnitForSubRecipe("count");
      }

      return {
        ok: true,
        targetYield: {
          ...subRecipe.yield,
          amount: line.amount,
        },
        warnings: [],
      };
    case "servings":
      if (line.unit !== "unit") {
        return invalidUnitForSubRecipe("servings");
      }

      return {
        ok: true,
        targetYield: {
          ...subRecipe.yield,
          amount: line.amount,
        },
        warnings: ["Servings scaling is approximate."],
      };
    case "mass":
      if (getUnit(line.unit).dimension !== "mass") {
        return invalidUnitForSubRecipe("mass");
      }

      return {
        ok: true,
        targetYield: {
          type: "mass",
          amount: line.amount,
          unit: line.unit,
        },
        warnings: [],
      };
    case "volume":
      if (getUnit(line.unit).dimension !== "volume") {
        return invalidUnitForSubRecipe("volume");
      }

      return {
        ok: true,
        targetYield: {
          type: "volume",
          amount: line.amount,
          unit: line.unit,
        },
        warnings: [],
      };
    case "moldArea":
    case "moldVolume":
      return {
        ok: false,
        reason: "Sub-recipes with mold yields cannot be used as measured recipe lines yet.",
        warnings: [],
      };
  }
}

export function getDefaultSubRecipeLineUnit(subRecipe: Recipe): UnitId {
  switch (subRecipe.yield.type) {
    case "mass":
    case "volume":
      return subRecipe.yield.unit;
    case "count":
    case "servings":
    case "moldArea":
    case "moldVolume":
      return "unit";
  }
}

export function getAllowedSubRecipeLineDimensions(subRecipe: Recipe): UnitDimension[] {
  switch (subRecipe.yield.type) {
    case "mass":
      return ["mass"];
    case "volume":
      return ["volume"];
    case "count":
    case "servings":
    case "moldArea":
    case "moldVolume":
      return ["count"];
  }
}

export function getAvailableSubRecipes(currentRecipeId: string, recipes: Recipe[]) {
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  return recipes.filter(
    (recipe) =>
      recipe.isSubRecipe &&
      recipe.id !== currentRecipeId &&
      !recipeReferencesRecipe(recipe.id, currentRecipeId, recipeById),
  );
}

export function findSubRecipeCycle(recipe: Recipe, recipes: Recipe[]) {
  const recipeById = new Map(recipes.map((existingRecipe) => [existingRecipe.id, existingRecipe]));
  recipeById.set(recipe.id, recipe);

  for (const line of recipe.lines) {
    if (line.itemType !== "recipe" || !line.subRecipeId) {
      continue;
    }

    if (line.subRecipeId === recipe.id) {
      return "Recipe cannot contain itself as a sub-recipe.";
    }

    if (recipeReferencesRecipe(line.subRecipeId, recipe.id, recipeById)) {
      return "Recipe cannot contain itself through nested sub-recipes.";
    }
  }

  return null;
}

function recipeReferencesRecipe(
  recipeId: string,
  targetRecipeId: string,
  recipeById: Map<string, Recipe>,
  seen = new Set<string>(),
): boolean {
  if (seen.has(recipeId)) {
    return false;
  }

  seen.add(recipeId);
  const recipe = recipeById.get(recipeId);

  if (!recipe) {
    return false;
  }

  return recipe.lines.some((line) => {
    if (line.itemType !== "recipe" || !line.subRecipeId) {
      return false;
    }

    return (
      line.subRecipeId === targetRecipeId ||
      recipeReferencesRecipe(line.subRecipeId, targetRecipeId, recipeById, seen)
    );
  });
}

function invalidUnitForSubRecipe(yieldType: YieldDefinition["type"]): SubRecipeTargetYieldResult {
  return {
    ok: false,
    reason: `Sub-recipe line unit must match the sub-recipe ${yieldType} yield.`,
    warnings: [],
  };
}
