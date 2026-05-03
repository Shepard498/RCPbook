import { liveQuery } from "dexie";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../app/i18n";
import { useAppPreferences } from "../../app/preferences";
import { useRouteActions } from "../../app/routeActions";
import { useInAppBackClose } from "../../app/useInAppBackClose";
import { db } from "../../db/db";
import type { Ingredient, PurchaseOption } from "../../domain/ingredients/ingredientTypes";
import type { Recipe } from "../../domain/recipes/recipeTypes";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { formatYield } from "../../domain/recipes/yieldFormatting";
import { SearchInput } from "../common/SearchInput";
import { RecipeEditor } from "./RecipeEditor";
import { RecipeList } from "./RecipeList";
import { RecipePreview } from "./RecipePreview";

export function RecipesPage() {
  const { t } = useI18n();
  const { confirmDeletes } = useAppPreferences();
  const { setAction } = useRouteActions();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [purchaseOptions, setPurchaseOptions] = useState<PurchaseOption[]>([]);
  const [search, setSearch] = useState("");
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [pendingDeleteRecipe, setPendingDeleteRecipe] = useState<Recipe | null>(null);
  const [isCreating, setIsCreating] = useState(false);
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

  const filteredRecipes = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return recipes;
    }

    return recipes.filter((recipe) => {
      return (
        recipe.name.toLowerCase().includes(query) ||
        (recipe.description ?? "").toLowerCase().includes(query) ||
        formatYield(recipe.yield).toLowerCase().includes(query)
      );
    });
  }, [recipes, search]);

  const selectedRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null,
    [recipes, selectedRecipeId],
  );
  const hasActiveDetail = isCreating || Boolean(editingRecipe) || Boolean(selectedRecipe);
  const canPrintRecipe = Boolean(selectedRecipe) && !isCreating && !editingRecipe;

  useInAppBackClose(hasActiveDetail, returnToList, "recipes-detail");

  useEffect(() => {
    setAction(
      <button
        type="button"
        className="print-button"
        disabled={!canPrintRecipe}
        onClick={() => window.print()}
      >
        {t("Print")}
      </button>,
    );

    return () => setAction(null);
  }, [canPrintRecipe, setAction, t]);

  function returnToList() {
    setSelectedRecipeId(null);
    setEditingRecipe(null);
    setIsCreating(false);
  }

  function startCreatingRecipe() {
    setIsCreating(true);
    setEditingRecipe(null);
    setSelectedRecipeId(null);
  }

  async function deleteRecipe(recipe: Recipe) {
    await db.recipes.delete(recipe.id);

    if (editingRecipe?.id === recipe.id) {
      setEditingRecipe(null);
      setIsCreating(false);
    }

    if (selectedRecipeId === recipe.id) {
      setSelectedRecipeId(null);
    }

    setPendingDeleteRecipe(null);
  }

  function requestDeleteRecipe(recipe: Recipe) {
    if (confirmDeletes) {
      setPendingDeleteRecipe(recipe);
      return;
    }

    void deleteRecipe(recipe);
  }

  return (
    <main id="recipes" className={`list-detail-page ${hasActiveDetail ? "has-active-detail" : ""}`}>
      {error ? <p className="validation-message">{error}</p> : null}

      <div className="recipes-layout">
        <section className="panel list-detail-list">
          <div className="search-row list-card-toolbar">
            <SearchInput value={search} onChange={setSearch} placeholder="Cake, cookies, 12..." />
            <button type="button" className="primary add-button" aria-label={t("Add recipe")} onClick={startCreatingRecipe}>
              <span className="desktop-button-label">{t("Add recipe")}</span>
              <span className="mobile-plus-label" aria-hidden="true">+</span>
            </button>
          </div>
          <RecipeList
            recipes={filteredRecipes}
            selectedRecipeId={editingRecipe?.id ?? selectedRecipeId ?? undefined}
            onSelect={(recipe) => {
              setSelectedRecipeId(recipe.id);
              setEditingRecipe(null);
              setIsCreating(false);
            }}
            onEdit={(recipe) => {
              setSelectedRecipeId(recipe.id);
              setEditingRecipe(recipe);
              setIsCreating(false);
            }}
            onDelete={requestDeleteRecipe}
          />
        </section>

        <div className="list-detail-detail">
          {isCreating || editingRecipe ? (
            <RecipeEditor
              key={editingRecipe?.id ?? "new"}
              recipe={isCreating ? null : editingRecipe}
              ingredients={ingredients}
              recipes={recipes}
              onBack={returnToList}
              onSaved={(recipe) => {
                setSelectedRecipeId(recipe.id);
                setEditingRecipe(null);
                setIsCreating(false);
              }}
              onCancel={() => {
                setEditingRecipe(null);
                setIsCreating(false);
              }}
            />
          ) : selectedRecipe ? (
            <RecipePreview
              recipe={selectedRecipe}
              ingredients={ingredients}
              purchaseOptions={purchaseOptions}
              recipes={recipes}
              onBack={returnToList}
              onEdit={(recipe) => {
                setSelectedRecipeId(recipe.id);
                setEditingRecipe(recipe);
              }}
              onDelete={requestDeleteRecipe}
            />
          ) : (
            <aside className="panel">
              <div className="panel-body empty-state">{t("Select a recipe or add a new one.")}</div>
            </aside>
          )}
        </div>
      </div>
      {pendingDeleteRecipe ? (
        <ConfirmDialog
          title={t("Delete recipe")}
          message={t("Delete {name}? This cannot be undone.", { name: pendingDeleteRecipe.name })}
          onCancel={() => setPendingDeleteRecipe(null)}
          onConfirm={() => {
            void deleteRecipe(pendingDeleteRecipe);
          }}
        />
      ) : null}
    </main>
  );
}
