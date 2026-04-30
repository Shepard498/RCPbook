import { liveQuery } from "dexie";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../app/i18n";
import { db } from "../../db/db";
import type { Ingredient } from "../../domain/ingredients/ingredientTypes";
import type { InventoryItem } from "../../domain/inventory/inventoryTypes";
import type { UnitId } from "../../domain/units/unitTypes";
import { dateInputValueToIso, formatDate, todayIso, toDateInputValue } from "../../utils/dates";
import { createId } from "../../utils/ids";
import { formatNumber } from "../../utils/numbers";
import { MobileBackButton } from "../common/MobileBackButton";
import { NumberInput } from "../common/NumberInput";
import { SearchInput } from "../common/SearchInput";
import { UnitSelect } from "../common/UnitSelect";

interface InventoryDraft {
  id: string;
  ingredientId: string;
  amount: number;
  unit: UnitId;
  location: string;
  expirationDate: string;
  notes: string;
  createdAt: string;
}

export function InventoryPage() {
  const { t } = useI18n();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ingredientSubscription = liveQuery(() => db.ingredients.orderBy("name").toArray()).subscribe({
      next: setIngredients,
      error: (err) => setError(String(err)),
    });
    const inventorySubscription = liveQuery(() => db.inventory.orderBy("updatedAt").reverse().toArray()).subscribe({
      next: setInventoryItems,
      error: (err) => setError(String(err)),
    });

    return () => {
      ingredientSubscription.unsubscribe();
      inventorySubscription.unsubscribe();
    };
  }, []);

  const ingredientById = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [ingredients],
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return inventoryItems;
    }

    return inventoryItems.filter((item) => {
      const ingredientName = ingredientById.get(item.ingredientId)?.name.toLowerCase() ?? "";
      const location = item.location?.toLowerCase() ?? "";
      const notes = item.notes?.toLowerCase() ?? "";

      return (
        ingredientName.includes(query) ||
        location.includes(query) ||
        notes.includes(query) ||
        item.unit.toLowerCase().includes(query)
      );
    });
  }, [ingredientById, inventoryItems, search]);
  const hasActiveDetail = isCreating || Boolean(editingItem);

  function returnToList() {
    setEditingItem(null);
    setIsCreating(false);
  }

  async function deleteItem(item: InventoryItem) {
    const ingredientName = ingredientById.get(item.ingredientId)?.name ?? t("Unknown ingredient");
    const confirmed = window.confirm(
      t("Delete inventory item for {name}? This cannot be undone.", { name: ingredientName }),
    );

    if (!confirmed) {
      return;
    }

    await db.inventory.delete(item.id);

    if (editingItem?.id === item.id) {
      setEditingItem(null);
      setIsCreating(false);
    }
  }

  return (
    <main id="inventory" className={`list-detail-page ${hasActiveDetail ? "has-active-detail" : ""}`}>
      <div className="page-toolbar">
        <div className="page-title">
          <h2>{t("Inventory")}</h2>
        </div>
        <button
          type="button"
          className="primary"
          disabled={ingredients.length === 0}
          onClick={() => {
            setIsCreating(true);
            setEditingItem(null);
          }}
        >
          {t("Add stock item")}
        </button>
      </div>

      {error ? <p className="validation-message">{error}</p> : null}

      <div className="inventory-layout">
        <section className="panel list-detail-list">
          <div className="search-row">
            <SearchInput value={search} onChange={setSearch} placeholder="Flour, pantry, freezer..." />
          </div>
          <InventoryTable
            items={filteredItems}
            ingredientById={ingredientById}
            onEdit={(item) => {
              setEditingItem(item);
              setIsCreating(false);
            }}
            onDelete={deleteItem}
          />
        </section>

        <div className="list-detail-detail">
          {isCreating || editingItem ? (
            <InventoryEditor
              key={editingItem?.id ?? "new"}
              item={isCreating ? null : editingItem}
              ingredients={ingredients}
              onBack={returnToList}
              onSaved={() => {
                setEditingItem(null);
                setIsCreating(false);
              }}
              onCancel={() => {
                setEditingItem(null);
                setIsCreating(false);
              }}
            />
          ) : (
            <aside className="panel">
              <div className="panel-body empty-state">
                {ingredients.length === 0
                  ? t("Add ingredients before tracking inventory.")
                  : t("Select an inventory item or add a new one.")}
              </div>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}

function InventoryTable({
  items,
  ingredientById,
  onEdit,
  onDelete,
}: {
  items: InventoryItem[];
  ingredientById: Map<string, Ingredient>;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
}) {
  const { t } = useI18n();

  if (items.length === 0) {
    return <div className="empty-state">{t("No inventory items match the current search.")}</div>;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{t("Ingredient")}</th>
            <th>{t("Available stock")}</th>
            <th>{t("Location")}</th>
            <th>{t("Expiration date")}</th>
            <th>{t("Notes")}</th>
            <th>{t("Updated")}</th>
            <th aria-label={t("Actions")} />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const ingredient = ingredientById.get(item.ingredientId);

            return (
              <tr key={item.id}>
                <td>
                  <strong>{ingredient?.name ?? t("Unknown ingredient")}</strong>
                </td>
                <td>
                  {formatNumber(item.amount, 3)} {item.unit}
                </td>
                <td>{item.location || t("Not set")}</td>
                <td>{t(formatDate(item.expirationDate))}</td>
                <td>{item.notes || t("None")}</td>
                <td>{t(formatDate(item.updatedAt))}</td>
                <td>
                  <div className="inline-actions">
                    <button type="button" onClick={() => onEdit(item)}>
                      {t("Edit")}
                    </button>
                    <button type="button" className="danger" onClick={() => onDelete(item)}>
                      {t("Delete")}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InventoryEditor({
  item,
  ingredients,
  onBack,
  onSaved,
  onCancel,
}: {
  item: InventoryItem | null;
  ingredients: Ingredient[];
  onBack?: () => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<InventoryDraft>(() => createDraft(item, ingredients[0]));
  const [isSaving, setIsSaving] = useState(false);
  const ingredientById = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [ingredients],
  );
  const selectedIngredient = ingredientById.get(draft.ingredientId);
  const title = item
    ? t("Edit {name}", { name: selectedIngredient?.name ?? t("Inventory item") })
    : t("Add stock item");

  async function saveItem() {
    if (!draft.ingredientId) {
      window.alert(t("Ingredient is required."));
      return;
    }

    if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
      window.alert(t("Inventory amount must be greater than zero."));
      return;
    }

    setIsSaving(true);

    const now = todayIso();
    const normalizedItem: InventoryItem = {
      id: draft.id,
      ingredientId: draft.ingredientId,
      amount: draft.amount,
      unit: draft.unit,
      location: draft.location.trim() || undefined,
      expirationDate: draft.expirationDate || undefined,
      notes: draft.notes.trim() || undefined,
      createdAt: draft.createdAt,
      updatedAt: now,
    };

    try {
      await db.inventory.put(normalizedItem);
      onSaved();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <aside className="panel" aria-label={title}>
      <div className="panel-header">
        {onBack ? <MobileBackButton onClick={onBack} /> : null}
        <div>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="panel-body">
        <div className="inventory-note">
          {t("Inventory is not connected to batch planning yet.")}
        </div>

        <div className="form-grid">
          <label className="full-width">
            {t("Ingredient")}
            <select
              value={draft.ingredientId}
              onChange={(event) => {
                const nextIngredient = ingredientById.get(event.target.value);
                setDraft({
                  ...draft,
                  ingredientId: event.target.value,
                  unit: nextIngredient?.preferredUnit ?? draft.unit,
                });
              }}
            >
              {ingredients.map((ingredient) => (
                <option key={ingredient.id} value={ingredient.id}>
                  {ingredient.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            {t("Amount")}
            <NumberInput
              min={0}
              value={draft.amount}
              onValueChange={(amount) => setDraft({ ...draft, amount })}
            />
          </label>

          <label>
            {t("Unit")}
            <UnitSelect value={draft.unit} onChange={(unit) => setDraft({ ...draft, unit })} />
          </label>

          <label>
            {t("Location")}
            <input
              value={draft.location}
              placeholder={t("Optional")}
              onChange={(event) => setDraft({ ...draft, location: event.target.value })}
            />
          </label>

          <label>
            {t("Expiration date")}
            <input
              type="date"
              value={toDateInputValue(draft.expirationDate)}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  expirationDate: event.target.value ? dateInputValueToIso(event.target.value) : "",
                })
              }
            />
          </label>

          <label className="full-width">
            {t("Notes")}
            <textarea
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="panel-footer">
        <div className="editor-actions">
          <button type="button" onClick={onCancel}>
            {t("Cancel")}
          </button>
          <button type="button" className="primary" disabled={isSaving} onClick={saveItem}>
            {isSaving ? `${t("Saving")}...` : t("Save inventory item")}
          </button>
        </div>
      </div>
    </aside>
  );
}

function createDraft(item: InventoryItem | null, defaultIngredient?: Ingredient): InventoryDraft {
  const now = todayIso();

  return {
    id: item?.id ?? createId(),
    ingredientId: item?.ingredientId ?? defaultIngredient?.id ?? "",
    amount: item?.amount ?? 1,
    unit: item?.unit ?? defaultIngredient?.preferredUnit ?? "g",
    location: item?.location ?? "",
    expirationDate: item?.expirationDate ?? "",
    notes: item?.notes ?? "",
    createdAt: item?.createdAt ?? now,
  };
}
