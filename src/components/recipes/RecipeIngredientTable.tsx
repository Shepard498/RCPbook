import { useEffect, useRef } from "react";
import { useI18n } from "../../app/i18n";
import { useAppPreferences } from "../../app/preferences";
import type { Ingredient } from "../../domain/ingredients/ingredientTypes";
import type { Recipe, RecipeLine } from "../../domain/recipes/recipeTypes";
import {
  getAllowedSubRecipeLineDimensions,
  getAvailableSubRecipes,
  getDefaultSubRecipeLineUnit,
} from "../../domain/recipes/subRecipeMath";
import { formatYield } from "../../domain/recipes/yieldFormatting";
import { NumberInput } from "../common/NumberInput";
import { UnitSelect } from "../common/UnitSelect";

interface RecipeIngredientTableProps {
  lines: RecipeLine[];
  ingredients: Ingredient[];
  recipes: Recipe[];
  currentRecipeId: string;
  canAddIngredientLine: boolean;
  canAddSubRecipeLine: boolean;
  scrollToLineId?: string | null;
  onAddIngredientLine: () => void;
  onAddSubRecipeLine: () => void;
  onChange: (lines: RecipeLine[]) => void;
  onLineScrolled?: (lineId: string) => void;
}

export function RecipeIngredientTable({
  lines,
  ingredients,
  recipes,
  currentRecipeId,
  canAddIngredientLine,
  canAddSubRecipeLine,
  scrollToLineId,
  onAddIngredientLine,
  onAddSubRecipeLine,
  onChange,
  onLineScrolled,
}: RecipeIngredientTableProps) {
  const { t } = useI18n();
  const { confirmDeletes } = useAppPreferences();
  const lineRefs = useRef(new Map<string, HTMLDivElement>());
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const availableSubRecipes = getAvailableSubRecipes(currentRecipeId, recipes);
  const sortedLines = [...lines].sort((a, b) => a.sortOrder - b.sortOrder);

  useEffect(() => {
    if (!scrollToLineId) {
      return;
    }

    const lineElement = lineRefs.current.get(scrollToLineId);

    if (!lineElement) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      scrollElementToPanelTop(lineElement);
      onLineScrolled?.(scrollToLineId);
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [scrollToLineId, onLineScrolled]);

  function updateLine(id: string, patch: Partial<RecipeLine>) {
    onChange(lines.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function deleteLine(id: string) {
    if (confirmDeletes && !window.confirm(t("Delete recipe line? This cannot be undone."))) {
      return;
    }

    onChange(renumber(lines.filter((line) => line.id !== id)));
  }

  function setLineRef(lineId: string, element: HTMLDivElement | null) {
    if (element) {
      lineRefs.current.set(lineId, element);
      return;
    }

    lineRefs.current.delete(lineId);
  }

  return (
    <section className="editor-section">
      <div className="section-header">
        <h3>{t("Recipe lines")}</h3>
      </div>

      <div className="recipe-line-list">
        {sortedLines.map((line, index) => {
          const selectedIngredient = line.ingredientId ? ingredientById.get(line.ingredientId) : undefined;
          const selectedSubRecipe = line.subRecipeId ? recipeById.get(line.subRecipeId) : undefined;

          return (
            <div className="recipe-line-row" key={line.id} ref={(element) => setLineRef(line.id, element)}>
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

        <div className="recipe-line-placeholders">
          <button
            type="button"
            className="add-placeholder-card recipe-line-placeholder"
            disabled={!canAddIngredientLine}
            onClick={onAddIngredientLine}
            aria-label={t("Add ingredient")}
            title={t("Add ingredient")}
          >
            <span className="placeholder-plus" aria-hidden="true">+</span>
            <span>{t("Add ingredient")}</span>
          </button>
          <button
            type="button"
            className="add-placeholder-card recipe-line-placeholder"
            disabled={!canAddSubRecipeLine}
            onClick={onAddSubRecipeLine}
            aria-label={t("Add sub-recipe")}
            title={t("Add sub-recipe")}
          >
            <span className="placeholder-plus" aria-hidden="true">+</span>
            <span>{t("Add sub-recipe")}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function scrollElementToPanelTop(element: HTMLElement) {
  const container = element.closest(".panel-body");

  if (container instanceof HTMLElement) {
    const containerTop = container.getBoundingClientRect().top;
    const elementTop = element.getBoundingClientRect().top;

    container.scrollTo({
      top: container.scrollTop + elementTop - containerTop,
      behavior: "smooth",
    });
    return;
  }

  element.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
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
