import { liveQuery } from "dexie";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../app/i18n";
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
  const isMiscellaneous = mode === "miscellaneous";
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<IngredientCategory[]>([]);
  const [purchaseOptions, setPurchaseOptions] = useState<PurchaseOption[]>([]);
  const [search, setSearch] = useState("");
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(null);
  const [pendingDeleteIngredient, setPendingDeleteIngredient] = useState<Ingredient | null>(null);
  const [isCreating, setIsCreating] = useState(false);
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
  const editorOptions = editorIngredient
    ? purchaseOptionsByIngredient.get(editorIngredient.id) ?? []
    : [];
  const selectedIngredient = useMemo(
    () => pageIngredients.find((ingredient) => ingredient.id === selectedIngredientId) ?? null,
    [pageIngredients, selectedIngredientId],
  );
  const selectedOptions = selectedIngredient
    ? purchaseOptionsByIngredient.get(selectedIngredient.id) ?? []
    : [];
  const hasActiveDetail = isCreating || Boolean(editingIngredient) || Boolean(selectedIngredient);

  function returnToList() {
    setSelectedIngredientId(null);
    setEditingIngredient(null);
    setIsCreating(false);
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
    }

    setPendingDeleteIngredient(null);
  }

  return (
    <main
      id={isMiscellaneous ? "miscellaneous" : "ingredients"}
      className={`list-detail-page ${hasActiveDetail ? "has-active-detail" : ""}`}
    >
      <div className="page-toolbar">
        <div className="page-title">
          <h2>{isMiscellaneous ? t("Miscellaneous") : t("Ingredients")}</h2>
        </div>
        <button
          type="button"
          className="primary"
          onClick={() => {
            setIsCreating(true);
            setEditingIngredient(null);
            setSelectedIngredientId(null);
          }}
        >
          {isMiscellaneous ? t("Add item") : t("Add ingredient")}
        </button>
      </div>

      {error ? <p className="validation-message">{error}</p> : null}

      <div className="ingredients-layout">
        <section className="panel list-detail-list">
          <div className="search-row">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={isMiscellaneous ? "Bag, box, paper..." : "Flour, dairy, g..."}
            />
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
              setIsCreating(false);
            }}
            onEdit={(ingredient) => {
              setSelectedIngredientId(ingredient.id);
              setEditingIngredient(ingredient);
              setIsCreating(false);
            }}
            onDelete={setPendingDeleteIngredient}
          />
        </section>

        <div className="list-detail-detail">
          {isCreating || editingIngredient ? (
            <IngredientEditor
              key={editingIngredient?.id ?? "new"}
              ingredient={editorIngredient}
              categories={pageCategories}
              purchaseOptions={editorOptions}
              defaultCategoryId={isMiscellaneous ? miscellaneousCategoryId : undefined}
              isCategoryLocked={isMiscellaneous}
              addTitle={isMiscellaneous ? t("Add item") : undefined}
              saveLabel={isMiscellaneous ? t("Save item") : undefined}
              onBack={returnToList}
              onSaved={() => {
                setSelectedIngredientId(editingIngredient?.id ?? null);
                setEditingIngredient(null);
                setIsCreating(false);
              }}
              onCancel={() => {
                setEditingIngredient(null);
                setIsCreating(false);
              }}
            />
          ) : selectedIngredient ? (
            <IngredientPreview
              ingredient={selectedIngredient}
              categories={pageCategories}
              purchaseOptions={selectedOptions}
              eyebrowLabel={isMiscellaneous ? "Item" : undefined}
              onBack={returnToList}
              onEdit={(ingredient) => {
                setSelectedIngredientId(ingredient.id);
                setEditingIngredient(ingredient);
                setIsCreating(false);
              }}
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
    </main>
  );
}

function getPageCategories(categories: IngredientCategory[], isMiscellaneous: boolean) {
  if (isMiscellaneous) {
    return [miscellaneousCategory];
  }

  return categories.filter((category) => category.id !== miscellaneousCategoryId);
}
