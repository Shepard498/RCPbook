import { useEffect, useMemo, useState } from "react";
import { translateWarning, useI18n } from "../../app/i18n";
import { db } from "../../db/db";
import type { Ingredient } from "../../domain/ingredients/ingredientTypes";
import type { Recipe } from "../../domain/recipes/recipeTypes";
import { validateRecipe } from "../../domain/recipes/recipeValidation";
import { createDefaultYield } from "../../domain/recipes/yieldFormatting";
import { todayIso } from "../../utils/dates";
import { createId } from "../../utils/ids";
import { MobileBackButton } from "../common/MobileBackButton";
import { WarningList } from "../common/WarningList";
import { ProcedureStepEditor } from "./ProcedureStepEditor";
import { RecipeIngredientTable } from "./RecipeIngredientTable";
import { RecipePrintView } from "./RecipePrintView";
import { YieldEditor } from "./YieldEditor";

interface RecipeEditorProps {
  recipe: Recipe | null;
  ingredients: Ingredient[];
  recipes: Recipe[];
  onBack?: () => void;
  onSaved: (recipe: Recipe) => void;
  onCancel: () => void;
}

export function RecipeEditor({ recipe, ingredients, recipes, onBack, onSaved, onCancel }: RecipeEditorProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<Recipe>(() => createRecipeDraft(recipe));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(createRecipeDraft(recipe));
  }, [recipe]);

  const validation = useMemo(() => validateRecipe(draft, recipes), [draft, recipes]);
  const title = recipe ? t("Edit {name}", { name: recipe.name }) : t("Add recipe");

  async function saveRecipe() {
    const normalizedRecipe = normalizeRecipe(draft);
    const nextValidation = validateRecipe(normalizedRecipe, recipes);

    if (!nextValidation.ok) {
      window.alert(translateWarning(t, nextValidation.warnings[0]));
      return;
    }

    setIsSaving(true);
    try {
      await db.recipes.put(normalizedRecipe);
      onSaved(normalizedRecipe);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <aside className="panel recipe-editor" aria-label={title}>
      <div className="panel-header">
        {onBack ? <MobileBackButton onClick={onBack} /> : null}
        <div>
          <h2>{title}</h2>
        </div>
        <WarningList warnings={validation.warnings} />
      </div>

      <div className="panel-body">
        <div className="form-grid">
          <label>
            {t("Name")}
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoFocus />
          </label>

          <label className="checkbox-label recipe-toggle">
            <input
              type="checkbox"
              checked={draft.isSubRecipe}
              onChange={(event) => setDraft({ ...draft, isSubRecipe: event.target.checked })}
            />
            {t("Sub-recipe")}
          </label>

          <label className="full-width">
            {t("Description")}
            <input
              value={draft.description ?? ""}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </label>

          <label className="full-width">
            {t("Notes")}
            <textarea value={draft.notes ?? ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
          </label>
        </div>

        <YieldEditor value={draft.yield} onChange={(recipeYield) => setDraft({ ...draft, yield: recipeYield })} />
        <RecipeIngredientTable
          lines={draft.lines}
          ingredients={ingredients}
          recipes={recipes}
          currentRecipeId={draft.id}
          onChange={(lines) => setDraft({ ...draft, lines })}
        />
        <ProcedureStepEditor
          recipeId={draft.id}
          steps={draft.procedureSteps}
          onChange={(procedureSteps) => setDraft({ ...draft, procedureSteps })}
        />
      </div>

      <div className="panel-footer">
        <div className="editor-actions">
          <div className="table-actions">
            <button type="button" onClick={onCancel}>
              {t("Cancel")}
            </button>
            <button type="button" onClick={() => window.print()}>
              {t("Print")}
            </button>
          </div>
          <button type="button" className="primary" disabled={isSaving} onClick={saveRecipe}>
            {isSaving ? `${t("Saving")}...` : t("Save recipe")}
          </button>
        </div>
      </div>

      <RecipePrintView recipe={draft} ingredients={ingredients} recipes={recipes} />
    </aside>
  );
}

function createRecipeDraft(recipe: Recipe | null): Recipe {
  const now = todayIso();

  return (
    recipe
      ? {
          ...recipe,
          procedureSteps: recipe.procedureSteps.map((step) => ({
            ...step,
            text: step.notes ? `${step.text}\n\n${step.notes}` : step.text,
            notes: undefined,
          })),
        }
      : {
      id: createId(),
      name: "",
      yield: createDefaultYield(),
      isSubRecipe: false,
      lines: [],
      procedureSteps: [],
      createdAt: now,
      updatedAt: now,
    }
  );
}

function normalizeRecipe(recipe: Recipe): Recipe {
  const now = todayIso();

  return {
    ...recipe,
    name: recipe.name.trim(),
    description: recipe.description?.trim() || undefined,
    notes: recipe.notes?.trim() || undefined,
    lines: recipe.lines
      .map((line, index) => ({
        ...line,
        amount: Number(line.amount),
        ingredientId: line.itemType === "ingredient" ? line.ingredientId : undefined,
        subRecipeId: line.itemType === "recipe" ? line.subRecipeId : undefined,
        notes: line.notes?.trim() || undefined,
        sortOrder: index,
      }))
      .filter((line) =>
        line.itemType === "ingredient" ? Boolean(line.ingredientId) : Boolean(line.subRecipeId),
      ),
    procedureSteps: recipe.procedureSteps
      .map((step, index) => ({
        ...step,
        recipeId: recipe.id,
        text: step.text.trim(),
        time:
          step.time && step.time.value > 0
            ? step.time
            : step.timeMinutes && step.timeMinutes > 0
              ? { value: step.timeMinutes, unit: "min" as const }
              : undefined,
        timeMinutes: undefined,
        notes: undefined,
        sortOrder: index,
      }))
      .filter((step) => step.text),
    updatedAt: now,
  };
}
