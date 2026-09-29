import { liveQuery } from "dexie";
import { CircleCheck, Plus, TriangleAlert, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useI18n } from "../../app/i18n";
import { printDocument } from "../../app/platform";
import { useAppPreferences } from "../../app/preferences";
import { useRouteActions } from "../../app/routeActions";
import { db } from "../../db/db";
import type { Ingredient, PurchaseOption } from "../../domain/ingredients/ingredientTypes";
import type { InventoryItem } from "../../domain/inventory/inventoryTypes";
import type {
  BatchPlannerRecipeResult,
  BatchPlannerRow,
  BatchPurchaseMode,
} from "../../domain/production/batchPlannerTypes";
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
import { ConfirmDialog } from "../common/ConfirmDialog";
import { UnitSelect } from "../common/UnitSelect";
import { WarningList } from "../common/WarningList";
import { TargetYieldEditor } from "../calculator/TargetYieldEditor";
import { RecipePrintView, type RecipePrintStats } from "../recipes/RecipePrintView";

const miscellaneousCategoryId = "cat-packaging";
export const batchPlannerStorageKey = "recipe-app-batch-planner-rows";
type BatchPrintMode = "shopping" | "recipes";

export function BatchPlanner() {
  const { t } = useI18n();
  const { confirmDeletes } = useAppPreferences();
  const { setAction } = useRouteActions();
  const [activeBatchView, setActiveBatchView] = useState<"targets" | "shopping">("targets");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [purchaseOptions, setPurchaseOptions] = useState<PurchaseOption[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [rows, setRows] = useState<BatchPlannerRow[]>(() => readSavedRows());
  const [search, setSearch] = useState("");
  const [purchaseMode, setPurchaseMode] = useState<BatchPurchaseMode>("simple");
  const [showCoveredItems, setShowCoveredItems] = useState(true);
  const [printMode, setPrintMode] = useState<BatchPrintMode>("shopping");
  const [pendingDeleteRow, setPendingDeleteRow] = useState<BatchPlannerRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(batchPlannerStorageKey, JSON.stringify(rows));
  }, [rows]);

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

  useEffect(() => {
    const handleAppReset = () => setRows([]);

    window.addEventListener("recipe-app-reset", handleAppReset);
    return () => window.removeEventListener("recipe-app-reset", handleAppReset);
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
        purchaseMode,
      }),
    [ingredients, inventoryItems, purchaseMode, purchaseOptions, recipes, rows],
  );
  const hasShoppingList = batchPlan.ingredientTotals.length > 0;
  const hasPrintableRecipes = batchPlan.recipeResults.some((result) => Boolean(result.scaledRecipe));

  const printBatchDocument = useCallback((mode: BatchPrintMode) => {
    flushSync(() => setPrintMode(mode));
    void printDocument();
  }, []);

  useEffect(() => {
    setAction(
      <div className="batch-header-print-actions">
        <button
          type="button"
          className="print-button"
          onClick={() => printBatchDocument("shopping")}
          disabled={!hasShoppingList}
        >
          {t("Print shopping list")}
        </button>
        <button
          type="button"
          className="print-button"
          onClick={() => printBatchDocument("recipes")}
          disabled={!hasPrintableRecipes}
        >
          {t("Print recipes")}
        </button>
      </div>,
    );

    return () => setAction(null);
  }, [hasPrintableRecipes, hasShoppingList, printBatchDocument, setAction, t]);

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
    setPendingDeleteRow(null);
  }

  function requestDeleteRow(row: BatchPlannerRow) {
    if (confirmDeletes) {
      setPendingDeleteRow(row);
      return;
    }

    deleteRow(row.id);
  }

  return (
    <main id="production" className={`print-mode-${printMode}`}>
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
          <div className="batch-list-toolbar">
            <div className="batch-search-actions">
              <SearchInput value={search} onChange={setSearch} placeholder="Filter recipe choices..." />
              <div className="table-actions">
                <button
                  type="button"
                  className="primary add-button"
                  aria-label={t("Add recipe")}
                  onClick={addRow}
                  disabled={recipes.length === 0}
                >
                  <span className="desktop-button-label">{t("Add recipe")}</span>
                  <span className="mobile-plus-label" aria-hidden="true">+</span>
                </button>
                <button
                  type="button"
                  className="add-button"
                  aria-label={t("Add item")}
                  onClick={addItemRow}
                  disabled={miscellaneousItems.length === 0}
                >
                  <span className="desktop-button-label">{t("Add item")}</span>
                  <span className="mobile-plus-label" aria-hidden="true">+</span>
                </button>
              </div>
            </div>
          </div>
          <div className="panel-body batch-controls">

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
                          <label className="batch-row-choice" htmlFor={`batch-choice-${row.id}`}>
                            <span>{t("Recipe")}</span>
                            <select id={`batch-choice-${row.id}`} value={row.recipeId} onChange={(event) => updateRowRecipe(row.id, event.target.value)}>
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
                          <label className="batch-row-choice" htmlFor={`batch-choice-${row.id}`}>
                            <span>{t("Item")}</span>
                            <select id={`batch-choice-${row.id}`} value={row.ingredientId} onChange={(event) => updateRowItem(row.id, event.target.value)}>
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
                        className="icon-button danger batch-row-delete"
                        aria-label={t("Delete batch row")}
                        title={t("Delete batch row")}
                        onClick={() => requestDeleteRow(row)}
                      >
                        <X size={18} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="batch-add-placeholders">
              <button
                type="button"
                className="add-placeholder-card"
                aria-label={t("Add recipe")}
                onClick={addRow}
                disabled={recipes.length === 0}
              >
                <span className="placeholder-plus" aria-hidden="true"><Plus size={20} /></span>
                <span>{t("Add recipe")}</span>
              </button>
              <button
                type="button"
                className="add-placeholder-card"
                aria-label={t("Add miscellaneous item")}
                onClick={addItemRow}
                disabled={miscellaneousItems.length === 0}
              >
                <span className="placeholder-plus" aria-hidden="true"><Plus size={20} /></span>
                <span>{t("Add miscellaneous item")}</span>
              </button>
            </div>
          </div>
        </section>

        <BatchPlanSummary
          batchPlan={batchPlan}
          purchaseMode={purchaseMode}
          showCoveredItems={showCoveredItems}
          className={activeBatchView === "shopping" ? "batch-view-active" : "batch-view-inactive"}
          onPurchaseModeChange={setPurchaseMode}
          onShowCoveredItemsChange={setShowCoveredItems}
        />
      </div>
      <BatchRecipePrintView recipeResults={batchPlan.recipeResults} ingredients={ingredients} recipes={recipes} />
      {pendingDeleteRow ? (
        <ConfirmDialog
          title={t("Delete batch row")}
          message={t("Delete batch row? This cannot be undone.")}
          onCancel={() => setPendingDeleteRow(null)}
          onConfirm={() => deleteRow(pendingDeleteRow.id)}
        />
      ) : null}
    </main>
  );
}

function BatchPlanSummary({
  batchPlan,
  purchaseMode,
  showCoveredItems,
  className = "",
  onPurchaseModeChange,
  onShowCoveredItemsChange,
}: {
  batchPlan: ReturnType<typeof calculateBatchPlan>;
  purchaseMode: BatchPurchaseMode;
  showCoveredItems: boolean;
  className?: string;
  onPurchaseModeChange: (purchaseMode: BatchPurchaseMode) => void;
  onShowCoveredItemsChange: (showCoveredItems: boolean) => void;
}) {
  const { t } = useI18n();
  const visibleIngredientTotals = showCoveredItems
    ? batchPlan.ingredientTotals
    : batchPlan.ingredientTotals.filter((total) => total.requiredAmount > 0 || total.warnings.length > 0);

  return (
    <section className={`panel batch-plan-result ${className}`}>
      <div className="panel-header">
        <div className="batch-summary-title">
          <p className="eyebrow">{t("Production plan")}</p>
          <h2>{t("Shopping list")}</h2>
        </div>
        <div className="batch-summary-actions">
          <div className="batch-summary-controls print-hidden">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showCoveredItems}
                onChange={(event) => onShowCoveredItemsChange(event.target.checked)}
              />
              {t("Show covered items")}
            </label>
            <label className="compact-field">
              {t("Purchase logic")}
              <select
                value={purchaseMode}
                onChange={(event) =>
                  onPurchaseModeChange(event.target.value === "multiOption" ? "multiOption" : "simple")
                }
              >
                <option value="simple">{t("Simple purchase")}</option>
                <option value="multiOption">{t("Multi-option purchase")}</option>
              </select>
            </label>
          </div>
          <div className="batch-total-cost">
            <span className="muted">{t("Total cost")}</span>
            <strong>{formatOptionalCost(batchPlan.totalCost, batchPlan.currency, t)}</strong>
          </div>
        </div>
      </div>

      <div className="panel-body batch-plan-body">
        <section className="batch-print-section">
          <h3>{t("Recipes")}</h3>
          {batchPlan.recipeResults.length === 0 ? (
            <div className="empty-state">{t("No production targets yet.")}</div>
          ) : (
            <div className="table-scroll">
              <table className="batch-recipes-table">
                <thead>
                  <tr>
                    <th className="batch-recipe-name-column">{t("Recipe")}</th>
                    <th>{t("Target")}</th>
                    <th className="batch-recipe-scale-column">{t("Scale")}</th>
                    <th>{t("Cost")}</th>
                  </tr>
                </thead>
                <tbody>
                  {batchPlan.recipeResults.map((result) => (
                    <tr key={result.rowId}>
                      <td className="batch-recipe-name-column">
                        <div className="batch-recipe-heading">
                          <strong>{result.recipeName}</strong>
                          <span
                            className={`badge ${result.warnings.length > 0 ? "warning" : "neutral"} batch-recipe-warning-count`}
                            role="img"
                            aria-label={`${t("Warnings")}: ${result.warnings.length}`}
                            title={`${t("Warnings")}: ${result.warnings.length}`}
                          >
                            {result.warnings.length > 0 ? <TriangleAlert size={16} aria-hidden="true" /> : <CircleCheck size={16} aria-hidden="true" />}
                            {result.warnings.length}
                          </span>
                        </div>
                      </td>
                      <td>{formatYield(result.targetYield, t)}</td>
                      <td className="batch-recipe-scale-column">
                        {result.scaledRecipe ? formatNumber(result.scaledRecipe.scaleFactor, 3) : t("Cannot scale")}
                      </td>
                      <td>
                        {result.costResult?.totalCost !== null && result.costResult?.currency
                          ? formatCurrency(result.costResult.totalCost, result.costResult.currency)
                          : t("Incomplete")}
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
          ) : visibleIngredientTotals.length === 0 ? (
            <div className="empty-state">{t("No shopping-list items match the current filters.")}</div>
          ) : (
            <div className="table-scroll">
              <table className="batch-ingredients-table">
                <thead>
                  <tr>
                    <th className="batch-ingredient-name-column">{t("Ingredient")}</th>
                    <th className="batch-ingredient-total-column">{t("Total")}</th>
                    <th className="batch-ingredient-inventory-column">{t("Inventory")}</th>
                    <th className="batch-ingredient-needed-cost-column">{t("Needed cost")}</th>
                    <th>{t("Actual purchase")}</th>
                    <th>{t("Purchase cost")}</th>
                    <th className="batch-ingredient-warnings-column">{t("Warnings")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleIngredientTotals.map((total) => (
                    <tr key={total.ingredientId}>
                      <td className="batch-ingredient-name-column">
                        <strong>{total.ingredientName}</strong>
                      </td>
                      <td className="batch-ingredient-total-column">{formatPracticalAmount(total.amount, total.unit)}</td>
                      <td className="batch-ingredient-inventory-column">{formatPracticalAmount(total.inventoryAmount, total.unit)}</td>
                      <td className="batch-ingredient-needed-cost-column">{formatOptionalCost(total.requiredCost, total.requiredCostCurrency, t)}</td>
                      <td>{formatPurchasePlan(total, t)}</td>
                      <td>{formatOptionalCost(total.purchaseCost, total.purchaseCostCurrency, t)}</td>
                      <td className="batch-ingredient-warnings-column">
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

function BatchRecipePrintView({
  recipeResults,
  ingredients,
  recipes,
}: {
  recipeResults: BatchPlannerRecipeResult[];
  ingredients: Ingredient[];
  recipes: Recipe[];
}) {
  const { t } = useI18n();

  return (
    <div className="batch-recipe-print" aria-hidden="true">
      {recipeResults.map((result) => {
        if (!result.scaledRecipe) {
          return null;
        }

        return (
          <RecipePrintView
            key={result.rowId}
            recipe={result.scaledRecipe.recipe}
            ingredients={ingredients}
            recipes={recipes}
            stats={getBatchRecipePrintStats(result, t)}
            className="recipe-print-preview batch-recipe-print-item"
            includeSubRecipes
          />
        );
      })}
    </div>
  );
}

function cloneYield(yieldDefinition: YieldDefinition): YieldDefinition {
  return JSON.parse(JSON.stringify(yieldDefinition)) as YieldDefinition;
}

function readSavedRows(): BatchPlannerRow[] {
  try {
    const savedRows = localStorage.getItem(batchPlannerStorageKey);

    if (!savedRows) {
      return [];
    }

    const parsedRows = JSON.parse(savedRows);

    return Array.isArray(parsedRows) ? (parsedRows as BatchPlannerRow[]) : [];
  } catch {
    return [];
  }
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

  return (
    <div className="purchase-plan-lines">
      {purchasePlan.lines.map((line) => (
        <div className="purchase-plan-line" key={line.purchaseOptionId}>
          {formatNumber(line.packageCount, 0)} x {formatPracticalAmount(line.packageAmount, line.packageUnit)}
        </div>
      ))}
    </div>
  );
}

function getBatchRecipePrintStats(
  result: BatchPlannerRecipeResult,
  t: (key: string) => string,
): RecipePrintStats {
  const costResult = result.costResult;
  const recipeYield = result.scaledRecipe?.recipe.yield ?? result.targetYield;

  return {
    totalCost:
      costResult?.totalCost !== null && costResult?.currency
        ? formatCurrency(costResult.totalCost, costResult.currency)
        : t("Incomplete"),
    costPerOutput: getRecipeCostPerOutput(recipeYield, costResult, t),
  };
}

function getRecipeCostPerOutput(
  targetYield: YieldDefinition,
  costResult: BatchPlannerRecipeResult["costResult"],
  t: (key: string) => string,
) {
  if (!costResult || costResult.totalCost === null || !costResult.currency) {
    return t("Incomplete");
  }

  if (targetYield.type !== "count" && targetYield.type !== "servings") {
    return t("Not available");
  }

  if (!Number.isFinite(targetYield.amount) || targetYield.amount <= 0) {
    return t("Incomplete");
  }

  return `${formatCurrency(costResult.totalCost / targetYield.amount, costResult.currency)}/${
    targetYield.type === "count" ? targetYield.label || "unit" : targetYield.label || "serving"
  }`;
}

function formatOptionalCost(cost: number | null, currency: string | null, t: (key: string) => string) {
  if (cost === null) {
    return t("Incomplete");
  }

  return formatCurrency(cost, currency ?? "$");
}
