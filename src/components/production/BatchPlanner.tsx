import { liveQuery } from "dexie";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../app/i18n";
import { db } from "../../db/db";
import type { Ingredient, PurchaseOption } from "../../domain/ingredients/ingredientTypes";
import type { InventoryItem } from "../../domain/inventory/inventoryTypes";
import type { BatchPlannerRow } from "../../domain/production/batchPlannerTypes";
import { calculateBatchPlan } from "../../domain/production/batchPlannerMath";
import type { Recipe } from "../../domain/recipes/recipeTypes";
import type { YieldDefinition } from "../../domain/recipes/yieldTypes";
import { formatYield } from "../../domain/recipes/yieldFormatting";
import type { UnitId } from "../../domain/units/unitTypes";
import { createId } from "../../utils/ids";
import { formatPracticalAmount } from "../../utils/amountFormatting";
import { formatCurrency, formatNumber } from "../../utils/numbers";
import { NumberInput } from "../common/NumberInput";
import { SearchInput } from "../common/SearchInput";
import { UnitSelect } from "../common/UnitSelect";
import { WarningList } from "../common/WarningList";
import { TargetYieldEditor } from "../calculator/TargetYieldEditor";

const miscellaneousCategoryId = "cat-packaging";

export function BatchPlanner() {
  const { t } = useI18n();
  const [activeBatchView, setActiveBatchView] = useState<"targets" | "shopping">("targets");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [purchaseOptions, setPurchaseOptions] = useState<PurchaseOption[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [rows, setRows] = useState<BatchPlannerRow[]>([]);
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
    const inventorySubscription = liveQuery(() => db.inventory.toArray()).subscribe({
      next: setInventoryItems,
      error: (err) => setError(String(err)),
    });

    return () => {
      recipeSubscription.unsubscribe();
      ingredientSubscription.unsubscribe();
      purchaseOptionSubscription.unsubscribe();
      inventorySubscription.unsubscribe();
    };
  }, []);

  const recipeById = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);
  const miscellaneousItems = useMemo(
    () => ingredients.filter((ingredient) => ingredient.categoryId === miscellaneousCategoryId),
    [ingredients],
  );
  const itemById = useMemo(
    () => new Map(miscellaneousItems.map((item) => [item.id, item])),
    [miscellaneousItems],
  );
  const filteredRecipes = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return recipes;
    }

    return recipes.filter(
      (recipe) =>
        recipe.name.toLowerCase().includes(query) ||
        formatYield(recipe.yield).toLowerCase().includes(query),
    );
  }, [recipes, search]);
  const batchPlan = useMemo(
    () =>
      calculateBatchPlan({
        rows,
        recipes,
        ingredients,
        purchaseOptions,
        inventoryItems,
      }),
    [ingredients, inventoryItems, purchaseOptions, recipes, rows],
  );

  function addRow() {
    const recipe = filteredRecipes[0] ?? recipes[0];

    if (!recipe) {
      return;
    }

    setRows([
      ...rows,
      {
        id: createId(),
        rowType: "recipe",
        recipeId: recipe.id,
        targetYield: cloneYield(recipe.yield),
      },
    ]);
  }

  function addItemRow() {
    const item = miscellaneousItems[0];

    if (!item) {
      return;
    }

    setRows([
      ...rows,
      {
        id: createId(),
        rowType: "item",
        ingredientId: item.id,
        amount: 1,
        unit: item.preferredUnit,
      },
    ]);
  }

  function updateRow(rowId: string, patch: Partial<BatchPlannerRow>) {
    setRows(rows.map((row) => (row.id === rowId ? ({ ...row, ...patch } as BatchPlannerRow) : row)));
  }

  function updateRowRecipe(rowId: string, recipeId: string) {
    const recipe = recipeById.get(recipeId);

    if (!recipe) {
      return;
    }

    updateRow(rowId, {
      recipeId,
      targetYield: cloneYield(recipe.yield),
    });
  }

  function updateRowItem(rowId: string, ingredientId: string) {
    const item = itemById.get(ingredientId);

    if (!item) {
      return;
    }

    updateRow(rowId, {
      ingredientId,
      unit: item.preferredUnit,
    });
  }

  function deleteRow(rowId: string) {
    setRows(rows.filter((row) => row.id !== rowId));
  }

  return (
    <main id="production">
      <div className="page-toolbar">
        <div className="page-title">
          <h2>{t("Batch Planner")}</h2>
        </div>
        <div className="table-actions">
          <button type="button" className="primary" onClick={addRow} disabled={recipes.length === 0}>
            {t("Add recipe")}
          </button>
          <button type="button" onClick={addItemRow} disabled={miscellaneousItems.length === 0}>
            {t("Add item")}
          </button>
        </div>
      </div>

      {error ? <p className="validation-message">{error}</p> : null}

      <div className="batch-view-tabs" role="tablist" aria-label={t("Batch Planner")}>
        <button
          type="button"
          role="tab"
          aria-selected={activeBatchView === "targets"}
          onClick={() => setActiveBatchView("targets")}
        >
          {t("Production targets")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeBatchView === "shopping"}
          onClick={() => setActiveBatchView("shopping")}
        >
          {t("Shopping list")}
        </button>
      </div>

      <div className="batch-layout">
        <section
          className={`panel batch-control-panel ${activeBatchView === "targets" ? "batch-view-active" : "batch-view-inactive"}`}
        >
          <div className="panel-header">
            <h2>{t("Production targets")}</h2>
          </div>
          <div className="panel-body batch-controls">
            <SearchInput value={search} onChange={setSearch} placeholder="Filter recipe choices..." />

            {rows.length === 0 ? (
              <div className="empty-state">{t("Add recipes to build a production plan.")}</div>
            ) : (
              <div className="batch-row-list">
                {rows.map((row, index) => {
                  const recipe = row.rowType === "recipe" ? recipeById.get(row.recipeId) : null;
                  const item = row.rowType === "item" ? itemById.get(row.ingredientId) : null;

                  return (
                    <div className="batch-row" key={row.id}>
                      <div className="line-number">{index + 1}</div>

                      {row.rowType === "recipe" ? (
                        <div className="batch-row-content">
                          <label>
                            {t("Recipe")}
                            <select value={row.recipeId} onChange={(event) => updateRowRecipe(row.id, event.target.value)}>
                              {filteredRecipes.map((recipeOption) => (
                                <option key={recipeOption.id} value={recipeOption.id}>
                                  {recipeOption.name}
                                </option>
                              ))}
                              {recipe && !filteredRecipes.some((recipeOption) => recipeOption.id === recipe.id) ? (
                                <option value={recipe.id}>{recipe.name}</option>
                              ) : null}
                            </select>
                          </label>

                          <div className="batch-row-specs">
                            <div className="batch-original-yield">
                              <span className="muted">{t("Original")}</span>
                              <strong>{recipe ? formatYield(recipe.yield, t) : t("Missing recipe")}</strong>
                            </div>

                            <div className="batch-target-yield">
                              <TargetYieldEditor
                                value={row.targetYield}
                                onChange={(targetYield) => updateRow(row.id, { targetYield })}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="batch-row-content">
                          <label>
                            {t("Item")}
                            <select value={row.ingredientId} onChange={(event) => updateRowItem(row.id, event.target.value)}>
                              {miscellaneousItems.map((itemOption) => (
                                <option key={itemOption.id} value={itemOption.id}>
                                  {itemOption.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <div className="batch-row-specs">
                            <label>
                              {t("Amount")}
                              <NumberInput
                                min={0}
                                value={row.amount}
                                onValueChange={(amount) => updateRow(row.id, { amount })}
                              />
                            </label>
                            <label>
                              {t("Unit")}
                              <UnitSelect
                                value={row.unit}
                                onChange={(unit: UnitId) => updateRow(row.id, { unit })}
                              />
                            </label>
                            <div className="batch-original-yield">
                              <span className="muted">{t("Preferred unit")}</span>
                              <strong>{item?.preferredUnit ?? t("Missing item")}</strong>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        className="icon-button danger"
                        aria-label={t("Delete batch row")}
                        title={t("Delete batch row")}
                        onClick={() => deleteRow(row.id)}
                      >
                        X
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <BatchPlanSummary
          batchPlan={batchPlan}
          className={activeBatchView === "shopping" ? "batch-view-active" : "batch-view-inactive"}
        />
      </div>
    </main>
  );
}

function BatchPlanSummary({
  batchPlan,
  className = "",
}: {
  batchPlan: ReturnType<typeof calculateBatchPlan>;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <section className={`panel batch-plan-result ${className}`}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">{t("Production plan")}</p>
          <h2>{t("Shopping list")}</h2>
        </div>
        <div className="batch-summary-actions">
          <button type="button" className="print-button" onClick={() => window.print()} disabled={batchPlan.ingredientTotals.length === 0}>
            {t("Print")}
          </button>
          <div className="batch-total-cost">
            <span className="muted">{t("Total cost")}</span>
            <strong>{formatOptionalCost(batchPlan.totalCost, batchPlan.currency, t)}</strong>
          </div>
        </div>
      </div>

      <div className="panel-body batch-plan-body">
        <div className="scaled-warning-row">
          <WarningList warnings={batchPlan.warnings} />
        </div>

        <section className="batch-print-section">
          <h3>{t("Recipes")}</h3>
          {batchPlan.recipeResults.length === 0 ? (
            <div className="empty-state">{t("No production targets yet.")}</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("Recipe")}</th>
                    <th>{t("Target")}</th>
                    <th>{t("Scale")}</th>
                    <th>{t("Cost")}</th>
                    <th>{t("Warnings")}</th>
                  </tr>
                </thead>
                <tbody>
                  {batchPlan.recipeResults.map((result) => (
                    <tr key={result.rowId}>
                      <td>
                        <strong>{result.recipeName}</strong>
                      </td>
                      <td>{formatYield(result.targetYield, t)}</td>
                      <td>
                        {result.scaledRecipe ? formatNumber(result.scaledRecipe.scaleFactor, 3) : t("Cannot scale")}
                      </td>
                      <td>
                        {result.costResult?.totalCost !== null && result.costResult?.currency
                          ? formatCurrency(result.costResult.totalCost, result.costResult.currency)
                          : t("Incomplete")}
                      </td>
                      <td>
                        <WarningList warnings={result.warnings} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="batch-print-section">
          <h3>{t("Total ingredients needed")}</h3>
          {batchPlan.ingredientTotals.length === 0 ? (
            <div className="empty-state">{t("Ingredient totals will appear here.")}</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("Ingredient")}</th>
                    <th>{t("Total")}</th>
                    <th>{t("Inventory")}</th>
                    <th>{t("Needed cost")}</th>
                    <th>{t("Actual purchase")}</th>
                    <th>{t("Purchase cost")}</th>
                    <th>{t("Warnings")}</th>
                  </tr>
                </thead>
                <tbody>
                  {batchPlan.ingredientTotals.map((total) => (
                    <tr key={total.ingredientId}>
                      <td>
                        <strong>{total.ingredientName}</strong>
                      </td>
                      <td>{formatPracticalAmount(total.amount, total.unit)}</td>
                      <td>{formatPracticalAmount(total.inventoryAmount, total.unit)}</td>
                      <td>{formatOptionalCost(total.requiredCost, total.requiredCostCurrency, t)}</td>
                      <td>{formatPurchasePlan(total, t)}</td>
                      <td>{formatOptionalCost(total.purchaseCost, total.purchaseCostCurrency, t)}</td>
                      <td>
                        <WarningList warnings={total.warnings} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function cloneYield(yieldDefinition: YieldDefinition): YieldDefinition {
  return JSON.parse(JSON.stringify(yieldDefinition)) as YieldDefinition;
}

function formatPurchasePlan(
  total: ReturnType<typeof calculateBatchPlan>["ingredientTotals"][number],
  t: (key: string) => string,
) {
  const purchasePlan = total.purchasePlan;

  if (total.requiredAmount <= 0) {
    return t("No purchase needed");
  }

  if (!purchasePlan) {
    return t("Not available");
  }

  return `${formatNumber(purchasePlan.packageCount, 0)} x ${formatPracticalAmount(
    purchasePlan.packageAmount,
    purchasePlan.packageUnit,
  )} = ${formatPracticalAmount(purchasePlan.purchasedAmount, purchasePlan.purchasedUnit)}`;
}

function formatOptionalCost(cost: number | null, currency: string | null, t: (key: string) => string) {
  if (cost === null) {
    return t("Incomplete");
  }

  return formatCurrency(cost, currency ?? "$");
}
