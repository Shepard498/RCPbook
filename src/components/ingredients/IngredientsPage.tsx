import { liveQuery } from "dexie";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../app/i18n";
import { useAppPreferences } from "../../app/preferences";
import { useInAppBackClose } from "../../app/useInAppBackClose";
import { db } from "../../db/db";
import type {
  Ingredient,
  IngredientCategory,
  PurchaseOption,
} from "../../domain/ingredients/ingredientTypes";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { SearchInput } from "../common/SearchInput";
import { IngredientEditor } from "./IngredientEditor";
import { IngredientList } from "./IngredientList";
import { IngredientPreview } from "./IngredientPreview";
import { PurchaseOptionEditor } from "./PurchaseOptionEditor";

const miscellaneousCategoryId = "cat-packaging";
const miscellaneousCategory: IngredientCategory = {
  id: miscellaneousCategoryId,
  name: "Miscellaneous",
  sortOrder: 140,
};

interface IngredientsPageProps {
  mode?: "ingredients" | "miscellaneous";
}

export function IngredientsPage({ mode = "ingredients" }: IngredientsPageProps) {
  const { t } = useI18n();
  const { confirmDeletes } = useAppPreferences();
  const isMiscellaneous = mode === "miscellaneous";
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<IngredientCategory[]>([]);
  const [purchaseOptions, setPurchaseOptions] = useState<PurchaseOption[]>([]);
  const [search, setSearch] = useState("");
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [editingPurchaseOption, setEditingPurchaseOption] = useState<PurchaseOption | null>(null);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(null);
  const [pendingDeleteIngredient, setPendingDeleteIngredient] = useState<Ingredient | null>(null);
  const [pendingDeletePurchaseOption, setPendingDeletePurchaseOption] = useState<PurchaseOption | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingPurchaseOption, setIsCreatingPurchaseOption] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ingredientSubscription = liveQuery(() => db.ingredients.orderBy("name").toArray()).subscribe({
      next: setIngredients,
      error: (err) => setError(String(err)),
    });
    const categorySubscription = liveQuery(() => db.categories.orderBy("sortOrder").toArray()).subscribe({
      next: setCategories,
      error: (err) => setError(String(err)),
    });
    const purchaseOptionSubscription = liveQuery(() => db.purchaseOptions.toArray()).subscribe({
      next: setPurchaseOptions,
      error: (err) => setError(String(err)),
    });

    return () => {
      ingredientSubscription.unsubscribe();
      categorySubscription.unsubscribe();
      purchaseOptionSubscription.unsubscribe();
    };
  }, []);

  const purchaseOptionsByIngredient = useMemo(() => {
    const grouped = new Map<string, PurchaseOption[]>();

    for (const option of purchaseOptions) {
      const existing = grouped.get(option.ingredientId) ?? [];
      existing.push(option);
      grouped.set(option.ingredientId, existing);
    }

    return grouped;
  }, [purchaseOptions]);

  const categoryById = useMemo(
    () =>
      new Map(
        getPageCategories(categories, isMiscellaneous).map((category) => [category.id, category]),
      ),
    [categories, isMiscellaneous],
  );

  const pageCategories = useMemo(
    () => getPageCategories(categories, isMiscellaneous),
    [categories, isMiscellaneous],
  );

  const pageIngredients = useMemo(
    () =>
      ingredients.filter((ingredient) =>
        isMiscellaneous
          ? ingredient.categoryId === miscellaneousCategoryId
          : ingredient.categoryId !== miscellaneousCategoryId,
      ),
    [ingredients, isMiscellaneous],
  );

  const filteredIngredients = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return pageIngredients;
    }

    return pageIngredients.filter((ingredient) => {
      const categoryName = ingredient.categoryId
        ? categoryById.get(ingredient.categoryId)?.name ?? ""
        : "";
      const translatedCategoryName = t(categoryName).toLowerCase();

      return (
        ingredient.name.toLowerCase().includes(query) ||
        categoryName.toLowerCase().includes(query) ||
        translatedCategoryName.includes(query) ||
        ingredient.preferredUnit.toLowerCase().includes(query)
      );
    });
  }, [categoryById, pageIngredients, search, t]);

  const editorIngredient = isCreating ? null : editingIngredient;
  const selectedIngredient = useMemo(
    () => pageIngredients.find((ingredient) => ingredient.id === selectedIngredientId) ?? null,
    [pageIngredients, selectedIngredientId],
  );
  const selectedOptions = selectedIngredient
    ? purchaseOptionsByIngredient.get(selectedIngredient.id) ?? []
    : [];
  const activePurchaseOption = editingPurchaseOption
    ? selectedOptions.find((option) => option.id === editingPurchaseOption.id) ?? editingPurchaseOption
    : null;
  const hasActiveDetail =
    isCreating ||
    isCreatingPurchaseOption ||
    Boolean(editingIngredient) ||
    Boolean(editingPurchaseOption) ||
    Boolean(selectedIngredient);

  useInAppBackClose(hasActiveDetail, returnToList, isMiscellaneous ? "miscellaneous-detail" : "ingredients-detail");

  function returnToList() {
    setSelectedIngredientId(null);
    setEditingIngredient(null);
    setEditingPurchaseOption(null);
    setIsCreating(false);
    setIsCreatingPurchaseOption(false);
  }

  function startCreatingIngredient() {
    setIsCreating(true);
    setEditingIngredient(null);
    setEditingPurchaseOption(null);
    setSelectedIngredientId(null);
    setIsCreatingPurchaseOption(false);
  }

  function startEditingIngredient(ingredient: Ingredient) {
    setSelectedIngredientId(ingredient.id);
    setEditingIngredient(ingredient);
    setEditingPurchaseOption(null);
    setIsCreating(false);
    setIsCreatingPurchaseOption(false);
  }

  function startCreatingPurchaseOption(ingredient: Ingredient) {
    setSelectedIngredientId(ingredient.id);
    setEditingIngredient(null);
    setEditingPurchaseOption(null);
    setIsCreating(false);
    setIsCreatingPurchaseOption(true);
  }

  function startEditingPurchaseOption(ingredient: Ingredient, option: PurchaseOption) {
    setSelectedIngredientId(ingredient.id);
    setEditingIngredient(null);
    setEditingPurchaseOption(option);
    setIsCreating(false);
    setIsCreatingPurchaseOption(false);
  }

  function returnToIngredientPreview() {
    setEditingIngredient(null);
    setEditingPurchaseOption(null);
    setIsCreating(false);
    setIsCreatingPurchaseOption(false);
  }

  async function deleteIngredient(ingredient: Ingredient) {
    await db.transaction("rw", db.ingredients, db.purchaseOptions, async () => {
      await db.ingredients.delete(ingredient.id);
      const optionIds = await db.purchaseOptions.where("ingredientId").equals(ingredient.id).primaryKeys();
      if (optionIds.length > 0) {
        await db.purchaseOptions.bulkDelete(optionIds.map(String));
      }
    });

    if (editingIngredient?.id === ingredient.id) {
      setEditingIngredient(null);
      setIsCreating(false);
    }

    if (selectedIngredientId === ingredient.id) {
      setSelectedIngredientId(null);
      setEditingPurchaseOption(null);
      setIsCreatingPurchaseOption(false);
    }

    setPendingDeleteIngredient(null);
  }

  function requestDeleteIngredient(ingredient: Ingredient) {
    if (confirmDeletes) {
      setPendingDeleteIngredient(ingredient);
      return;
    }

    void deleteIngredient(ingredient);
  }

  async function deletePurchaseOption(option: PurchaseOption) {
    await db.purchaseOptions.delete(option.id);

    if (editingPurchaseOption?.id === option.id) {
      setEditingPurchaseOption(null);
      setIsCreatingPurchaseOption(false);
    }

    setPendingDeletePurchaseOption(null);
  }

  function requestDeletePurchaseOption(option: PurchaseOption) {
    if (confirmDeletes) {
      setPendingDeletePurchaseOption(option);
      return;
    }

    void deletePurchaseOption(option);
  }

  return (
    <main
      id={isMiscellaneous ? "miscellaneous" : "ingredients"}
      className={`list-detail-page ${hasActiveDetail ? "has-active-detail" : ""}`}
    >
      {error ? <p className="validation-message">{error}</p> : null}

      <div className="ingredients-layout">
        <section className="panel list-detail-list">
          <div className="search-row list-card-toolbar">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={isMiscellaneous ? "Bag, box, paper..." : "Flour, dairy, g..."}
            />
            <button
              type="button"
              className="primary add-button"
              aria-label={isMiscellaneous ? t("Add item") : t("Add ingredient")}
              onClick={startCreatingIngredient}
            >
              <span className="desktop-button-label">{isMiscellaneous ? t("Add item") : t("Add ingredient")}</span>
              <span className="mobile-plus-label" aria-hidden="true">+</span>
            </button>
          </div>
          <IngredientList
            ingredients={filteredIngredients}
            categories={pageCategories}
            purchaseOptionsByIngredient={purchaseOptionsByIngredient}
            selectedIngredientId={editingIngredient?.id ?? selectedIngredientId ?? undefined}
            emptyMessage={isMiscellaneous ? "No items match the current search." : undefined}
            onSelect={(ingredient) => {
              setSelectedIngredientId(ingredient.id);
              setEditingIngredient(null);
              setEditingPurchaseOption(null);
              setIsCreating(false);
              setIsCreatingPurchaseOption(false);
            }}
            onEdit={(ingredient) => startEditingIngredient(ingredient)}
            onDelete={requestDeleteIngredient}
          />
        </section>

        <div className="list-detail-detail">
          {isCreating || editingIngredient ? (
            <IngredientEditor
              key={editingIngredient?.id ?? "new"}
              ingredient={editorIngredient}
              categories={pageCategories}
              defaultCategoryId={isMiscellaneous ? miscellaneousCategoryId : undefined}
              isCategoryLocked={isMiscellaneous}
              addTitle={isMiscellaneous ? t("Add item") : undefined}
              saveLabel={isMiscellaneous ? t("Save item") : undefined}
              onBack={returnToList}
              onSaved={(savedIngredient) => {
                setSelectedIngredientId(savedIngredient.id);
                setEditingIngredient(null);
                setEditingPurchaseOption(null);
                setIsCreating(false);
                setIsCreatingPurchaseOption(false);
              }}
              onCancel={() => {
                setEditingIngredient(null);
                setEditingPurchaseOption(null);
                setIsCreating(false);
                setIsCreatingPurchaseOption(false);
              }}
            />
          ) : selectedIngredient && (isCreatingPurchaseOption || activePurchaseOption) ? (
            <PurchaseOptionEditor
              key={activePurchaseOption?.id ?? "new-purchase-option"}
              ingredient={selectedIngredient}
              option={isCreatingPurchaseOption ? null : activePurchaseOption}
              isFirstOption={selectedOptions.length === 0}
              onBack={returnToList}
              onSaved={returnToIngredientPreview}
              onCancel={returnToIngredientPreview}
            />
          ) : selectedIngredient ? (
            <IngredientPreview
              ingredient={selectedIngredient}
              categories={pageCategories}
              purchaseOptions={selectedOptions}
              eyebrowLabel={isMiscellaneous ? "Item" : undefined}
              onBack={returnToList}
              onEdit={(ingredient) => startEditingIngredient(ingredient)}
              onAddPurchaseOption={() => startCreatingPurchaseOption(selectedIngredient)}
              onEditPurchaseOption={(option) => startEditingPurchaseOption(selectedIngredient, option)}
              onDeletePurchaseOption={requestDeletePurchaseOption}
              onDelete={requestDeleteIngredient}
            />
          ) : (
            <aside className="panel">
              <div className="panel-body empty-state">
                {isMiscellaneous
                  ? t("Select an item or add a new one.")
                  : t("Select an ingredient or add a new one.")}
              </div>
            </aside>
          )}
        </div>
      </div>
      {pendingDeleteIngredient ? (
        <ConfirmDialog
          title={isMiscellaneous ? t("Delete item") : t("Delete ingredient")}
          message={t("Delete {name} and all of its purchase options? This cannot be undone.", {
            name: pendingDeleteIngredient.name,
          })}
          onCancel={() => setPendingDeleteIngredient(null)}
          onConfirm={() => {
            void deleteIngredient(pendingDeleteIngredient);
          }}
        />
      ) : null}
      {pendingDeletePurchaseOption ? (
        <ConfirmDialog
          title={t("Delete purchase option")}
          message={t("Delete purchase option? This cannot be undone.")}
          onCancel={() => setPendingDeletePurchaseOption(null)}
          onConfirm={() => {
            void deletePurchaseOption(pendingDeletePurchaseOption);
          }}
        />
      ) : null}
    </main>
  );
}

function getPageCategories(categories: IngredientCategory[], isMiscellaneous: boolean) {
  if (isMiscellaneous) {
    return [miscellaneousCategory];
  }

  return categories.filter((category) => category.id !== miscellaneousCategoryId);
}
