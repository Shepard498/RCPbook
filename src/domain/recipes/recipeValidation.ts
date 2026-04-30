import type { Recipe } from "./recipeTypes";
import { createSubRecipeTargetYield, findSubRecipeCycle } from "./subRecipeMath";

export interface RecipeValidationResult {
  ok: boolean;
  warnings: string[];
}

export function validateRecipe(recipe: Recipe, recipes: Recipe[] = []): RecipeValidationResult {
  const warnings: string[] = [];
  const recipeById = new Map(recipes.map((existingRecipe) => [existingRecipe.id, existingRecipe]));
  recipeById.set(recipe.id, recipe);

  if (!recipe.name.trim()) {
    warnings.push("Recipe name is required.");
  }

  warnings.push(...validateYield(recipe));

  const cycleWarning = findSubRecipeCycle(recipe, recipes);
  if (cycleWarning) {
    warnings.push(cycleWarning);
  }

  for (const line of recipe.lines) {
    if (!Number.isFinite(line.amount) || line.amount <= 0) {
      warnings.push("Recipe lines need amounts greater than zero.");
      break;
    }

    if (line.itemType === "ingredient" && !line.ingredientId) {
      warnings.push("Ingredient lines need an ingredient.");
      break;
    }

    if (line.itemType === "recipe" && !line.subRecipeId) {
      warnings.push("Sub-recipe lines need a recipe.");
      break;
    }

    if (line.itemType === "recipe" && line.subRecipeId) {
      const subRecipe = recipeById.get(line.subRecipeId);

      if (!subRecipe) {
        warnings.push("Sub-recipe line is missing a recipe.");
        break;
      }

      if (!subRecipe.isSubRecipe) {
        warnings.push("Recipe lines can only reference recipes marked as sub-recipes.");
        break;
      }

      const targetYield = createSubRecipeTargetYield(subRecipe, line);
      if (!targetYield.ok) {
        warnings.push(targetYield.reason);
        break;
      }
    }
  }

  if (recipe.procedureSteps.some((step) => !step.text.trim())) {
    warnings.push("Procedure steps need text.");
  }

  return {
    ok: warnings.length === 0,
    warnings,
  };
}

function validateYield(recipe: Recipe) {
  const warnings: string[] = [];
  const recipeYield = recipe.yield;

  switch (recipeYield.type) {
    case "count":
    case "servings":
    case "mass":
    case "volume":
      if (!Number.isFinite(recipeYield.amount) || recipeYield.amount <= 0) {
        warnings.push("Yield amount must be greater than zero.");
      }
      break;
    case "moldArea":
      if (recipeYield.shape === "circle") {
        if (!recipeYield.circle || recipeYield.circle.diameter <= 0) {
          warnings.push("Round mold yield needs a diameter.");
        }
      } else if (
        !recipeYield.rectangle ||
        recipeYield.rectangle.width <= 0 ||
        recipeYield.rectangle.length <= 0
      ) {
        warnings.push("Rectangular mold yield needs width and length.");
      }
      break;
    case "moldVolume":
      if (recipeYield.shape === "cylinder") {
        if (!recipeYield.cylinder || recipeYield.cylinder.diameter <= 0 || recipeYield.cylinder.height <= 0) {
          warnings.push("Cylinder mold yield needs diameter and height.");
        }
      } else if (
        !recipeYield.rectangularPrism ||
        recipeYield.rectangularPrism.width <= 0 ||
        recipeYield.rectangularPrism.length <= 0 ||
        recipeYield.rectangularPrism.height <= 0
      ) {
        warnings.push("Box mold yield needs width, length, and height.");
      }
      break;
  }

  return warnings;
}
