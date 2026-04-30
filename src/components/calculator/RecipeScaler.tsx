import { liveQuery } from "dexie";
import { useEffect, useMemo, useState } from "react";
import { translateWarning, useI18n } from "../../app/i18n";
import { db } from "../../db/db";
import type { Ingredient, PurchaseOption } from "../../domain/ingredients/ingredientTypes";
import type { Recipe } from "../../domain/recipes/recipeTypes";
import { calculateScaledRecipeCost } from "../../domain/recipes/recipeCosting";
import { scaleRecipe } from "../../domain/recipes/scaling";
import type { YieldDefinition } from "../../domain/recipes/yieldTypes";
import { formatYield } from "../../domain/recipes/yieldFormatting";
import { SearchInput } from "../common/SearchInput";
import { WarningList } from "../common/WarningList";
import { ScaledRecipeView } from "./ScaledRecipeView";
import { TargetYieldEditor } from "./TargetYieldEditor";

export function RecipeScaler() {
  const { t } = useI18n();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [purchaseOptions, setPurchaseOptions] = useState<PurchaseOption[]>([]);
  const [recipeId, setRecipeId] = useState("");
  const [targetYield, setTargetYield] = useState<YieldDefinition | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const recipeSubscription = liveQuery(() => db.recipes.orderBy("name").toArray()).subscribe({
      next: setRecipes,
      error: (err) => setError(String(err)),
    });
    const ingredientSubscription = liveQuery(() => db.ingredients.orderBy("name").toArray()).subscribe({
      next: setIngredients,
      error: (err) => setError(String(err)),
    });
    const purchaseOptionSubscription = liveQuery(() => db.purchaseOptions.toArray()).subscribe({
      next: setPurchaseOptions,
      error: (err) => setError(String(err)),
    });

    return () => {
      recipeSubscription.unsubscribe();
      ingredientSubscription.unsubscribe();
      purchaseOptionSubscription.unsubscribe();
    };
  }, []);

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === recipeId) ?? null,
    [recipeId, recipes],
  );

  useEffect(() => {
    if (!selectedRecipe) {
      setTargetYield(null);
      return;
    }

    setTargetYield(cloneYield(selectedRecipe.yield));
  }, [selectedRecipe]);

  const filteredRecipes = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return recipes;
    }

    return recipes.filter((recipe) => {
      return recipe.name.toLowerCase().includes(query) || formatYield(recipe.yield).toLowerCase().includes(query);
    });
  }, [recipes, search]);

  const scaledRecipe = useMemo(() => {
    if (!selectedRecipe || !targetYield) {
      return null;
    }

    return scaleRecipe(selectedRecipe, targetYield);
  }, [selectedRecipe, targetYield]);

  const costResult = useMemo(() => {
    if (!scaledRecipe || !("recipe" in scaledRecipe)) {
      return null;
    }

    return calculateScaledRecipeCost({
      recipe: scaledRecipe.recipe,
      ingredients,
      purchaseOptions,
      recipes,
    });
  }, [ingredients, purchaseOptions, recipes, scaledRecipe]);

  return (
    <main id="calculator">
      <div className="page-toolbar">
        <div className="page-title">
          <h2>{t("Recipe Scaler")}</h2>
        </div>
      </div>

      {error ? <p className="validation-message">{error}</p> : null}

      <div className="calculator-layout">
        <section className="panel scaler-controls">
          <div className="panel-header">
            <h2>{t("Scale setup")}</h2>
          </div>
          <div className="panel-body scaler-control-body">
            <SearchInput value={search} onChange={setSearch} placeholder="Find a recipe..." />

            <label>
              {t("Recipe")}
              <select value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
                <option value="">{t("Select recipe")}</option>
                {filteredRecipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedRecipe && targetYield ? (
              <>
                <div className="scaler-original-yield">
                  <span className="muted">{t("Original yield")}</span>
                  <strong>{formatYield(selectedRecipe.yield, t)}</strong>
                </div>
                <TargetYieldEditor value={targetYield} onChange={setTargetYield} />
              </>
            ) : (
              <div className="empty-state">{t("Select a recipe to calculate a scaled version.")}</div>
            )}
          </div>
        </section>

        {scaledRecipe && "recipe" in scaledRecipe && costResult ? (
          <ScaledRecipeView
            scaledRecipe={scaledRecipe}
            ingredients={ingredients}
            recipes={recipes}
            costResult={costResult}
          />
        ) : scaledRecipe && "ok" in scaledRecipe ? (
          <section className="panel">
            <div className="panel-body">
              <p className="validation-message">{translateWarning(t, scaledRecipe.reason)}</p>
              <WarningList warnings={scaledRecipe.warnings} />
            </div>
          </section>
        ) : (
          <section className="panel">
            <div className="panel-body empty-state">{t("Scaled recipe results will appear here.")}</div>
          </section>
        )}
      </div>
    </main>
  );
}

function cloneYield(yieldDefinition: YieldDefinition): YieldDefinition {
  return JSON.parse(JSON.stringify(yieldDefinition)) as YieldDefinition;
}
