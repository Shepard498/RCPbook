import { useI18n } from "../../app/i18n";
import type { Ingredient } from "../../domain/ingredients/ingredientTypes";
import type { Recipe, RecipeLine } from "../../domain/recipes/recipeTypes";
import {
  getAllowedSubRecipeLineDimensions,
  getAvailableSubRecipes,
  getDefaultSubRecipeLineUnit,
} from "../../domain/recipes/subRecipeMath";
import { formatYield } from "../../domain/recipes/yieldFormatting";
import { createId } from "../../utils/ids";
import { NumberInput } from "../common/NumberInput";
import { UnitSelect } from "../common/UnitSelect";

interface RecipeIngredientTableProps {
  lines: RecipeLine[];
  ingredients: Ingredient[];
  recipes: Recipe[];
  currentRecipeId: string;
  onChange: (lines: RecipeLine[]) => void;
}

export function RecipeIngredientTable({
  lines,
  ingredients,
  recipes,
  currentRecipeId,
  onChange,
}: RecipeIngredientTableProps) {
  const { t } = useI18n();
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const availableSubRecipes = getAvailableSubRecipes(currentRecipeId, recipes);
  const sortedLines = [...lines].sort((a, b) => a.sortOrder - b.sortOrder);
  const canAddIngredientLine = ingredients.length > 0;
  const canAddSubRecipeLine = availableSubRecipes.length > 0;

  function addIngredientLine() {
    const ingredient = ingredients[0];

    if (!ingredient) {
      return;
    }

    onChange([
      ...lines,
      {
        id: createId(),
        itemType: "ingredient",
        ingredientId: ingredient.id,
        amount: 1,
        unit: ingredient.preferredUnit,
        sortOrder: lines.length,
      },
    ]);
  }

  function addSubRecipeLine() {
    const subRecipe = availableSubRecipes[0];

    if (!subRecipe) {
      return;
    }

    onChange([
      ...lines,
      {
        id: createId(),
        itemType: "recipe",
        subRecipeId: subRecipe.id,
        amount: 1,
        unit: getDefaultSubRecipeLineUnit(subRecipe),
        sortOrder: lines.length,
      },
    ]);
  }

  function updateLine(id: string, patch: Partial<RecipeLine>) {
    onChange(lines.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function deleteLine(id: string) {
    onChange(renumber(lines.filter((line) => line.id !== id)));
  }

  return (
    <section className="editor-section">
      <div className="section-header">
        <h3>{t("Recipe lines")}</h3>
        <div className="table-actions">
          <button type="button" disabled={!canAddIngredientLine} onClick={addIngredientLine}>
            {t("Add ingredient")}
          </button>
          <button type="button" disabled={!canAddSubRecipeLine} onClick={addSubRecipeLine}>
            {t("Add sub-recipe")}
          </button>
        </div>
      </div>

      {sortedLines.length === 0 ? (
        <div className="empty-state">{t("No ingredients added.")}</div>
      ) : (
        <div className="recipe-line-list">
          {sortedLines.map((line, index) => {
            const selectedIngredient = line.ingredientId ? ingredientById.get(line.ingredientId) : undefined;
            const selectedSubRecipe = line.subRecipeId ? recipeById.get(line.subRecipeId) : undefined;

            return (
              <div className="recipe-line-row" key={line.id}>
                <div className="line-number">{index + 1}</div>

                <label>
                  {line.itemType === "ingredient" ? t("Ingredient") : t("Sub-recipe")}
                  {line.itemType === "ingredient" ? (
                    <select
                      value={line.ingredientId ?? ""}
                      onChange={(event) => {
                        const nextIngredient = ingredientById.get(event.target.value);
                        updateLine(line.id, {
                          ingredientId: event.target.value,
                          subRecipeId: undefined,
                          unit: nextIngredient?.preferredUnit ?? line.unit,
                        });
                      }}
                    >
                      {ingredients.map((ingredient) => (
                        <option key={ingredient.id} value={ingredient.id}>
                          {ingredient.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={line.subRecipeId ?? ""}
                      onChange={(event) => {
                        const nextSubRecipe = recipeById.get(event.target.value);
                        updateLine(line.id, {
                          ingredientId: undefined,
                          subRecipeId: event.target.value,
                          unit: nextSubRecipe ? getDefaultSubRecipeLineUnit(nextSubRecipe) : line.unit,
                        });
                      }}
                    >
                      {availableSubRecipes.map((recipe) => (
                        <option key={recipe.id} value={recipe.id}>
                          {recipe.name}
                        </option>
                      ))}
                      {selectedSubRecipe && !availableSubRecipes.some((recipe) => recipe.id === selectedSubRecipe.id) ? (
                        <option value={selectedSubRecipe.id}>{selectedSubRecipe.name}</option>
                      ) : null}
                    </select>
                  )}
                </label>

                <label>
                  {t("Amount")}
                  <NumberInput
                    min={0}
                    value={line.amount}
                    onValueChange={(amount) => updateLine(line.id, { amount })}
                  />
                </label>

                <label>
                  {t("Unit")}
                  <UnitSelect
                    value={line.unit}
                    allowedDimensions={
                      line.itemType === "recipe" && selectedSubRecipe
                        ? getAllowedSubRecipeLineDimensions(selectedSubRecipe)
                        : undefined
                    }
                    onChange={(unit) => updateLine(line.id, { unit })}
                  />
                </label>

                <label className="notes-field">
                  {t("Notes")}
                  <input
                    value={line.notes ?? ""}
                    placeholder={
                      selectedIngredient?.preferredUnit
                        ? t("Usually {unit}", { unit: selectedIngredient.preferredUnit })
                        : selectedSubRecipe
                          ? formatSubRecipeHint(selectedSubRecipe, t)
                          : ""
                    }
                    onChange={(event) => updateLine(line.id, { notes: event.target.value })}
                  />
                </label>

                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={t("Delete recipe line")}
                  title={t("Delete recipe line")}
                  onClick={() => deleteLine(line.id)}
                >
                  X
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function renumber(lines: RecipeLine[]) {
  return lines.map((line, index) => ({
    ...line,
    sortOrder: index,
  }));
}

function formatSubRecipeHint(subRecipe: Recipe, t: (key: string) => string) {
  return `${t("Yield")}: ${formatYield(subRecipe.yield, t)}`;
}
