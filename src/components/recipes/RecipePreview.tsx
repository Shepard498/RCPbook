import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../app/i18n";
import { Pencil, X } from "lucide-react";
import type { Ingredient, PurchaseOption } from "../../domain/ingredients/ingredientTypes";
import { calculateRecipeCost } from "../../domain/recipes/recipeCosting";
import type { Recipe } from "../../domain/recipes/recipeTypes";
import { scaleRecipe } from "../../domain/recipes/scaling";
import type { YieldDefinition } from "../../domain/recipes/yieldTypes";
import { formatCurrency } from "../../utils/numbers";
import { MobileBackButton } from "../common/MobileBackButton";
import { WarningList } from "../common/WarningList";
import { RecipePrintView, type RecipePrintStats } from "./RecipePrintView";

interface RecipePreviewProps {
  recipe: Recipe;
  includeSubRecipes: boolean;
  ingredients: Ingredient[];
  purchaseOptions: PurchaseOption[];
  recipes: Recipe[];
  onBack?: () => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
}

export function RecipePreview({ recipe, includeSubRecipes, ingredients, purchaseOptions, recipes, onBack, onEdit, onDelete }: RecipePreviewProps) {
  const { t } = useI18n();
  const [targetYield, setTargetYield] = useState<YieldDefinition>(() => cloneYield(recipe.yield));
  const [targetYieldText, setTargetYieldText] = useState(() => formatTargetYieldInput(recipe.yield));

  useEffect(() => {
    const nextTargetYield = cloneYield(recipe.yield);
    setTargetYield(nextTargetYield);
    setTargetYieldText(formatTargetYieldInput(nextTargetYield));
  }, [recipe.id, recipe.yield]);

  const scaledRecipeResult = useMemo(() => scaleRecipe(recipe, targetYield), [recipe, targetYield]);
  const displayRecipe = "recipe" in scaledRecipeResult ? scaledRecipeResult.recipe : recipe;
  const scalingWarnings =
    "recipe" in scaledRecipeResult
      ? scaledRecipeResult.warnings
      : [scaledRecipeResult.reason, ...scaledRecipeResult.warnings];
  const costResult = useMemo(
    () =>
      calculateRecipeCost({
        recipe: displayRecipe,
        ingredients,
        purchaseOptions,
        recipes,
      }),
    [displayRecipe, ingredients, purchaseOptions, recipes],
  );
  const previewWarnings = Array.from(new Set([...scalingWarnings, ...costResult.warnings]));
  const printStats: RecipePrintStats = {
    totalCost:
      costResult.totalCost !== null && costResult.currency
        ? formatCurrency(costResult.totalCost, costResult.currency)
        : t("Incomplete"),
    costPerOutput: getCostPerOutput(displayRecipe.yield, costResult, t),
  };

  function updateTargetYield(value: string) {
    setTargetYieldText(value);
    setTargetYield(applyTargetYieldInput(targetYield, value));
  }

  return (
    <aside className="panel recipe-preview-panel">
      <div className="panel-header recipe-preview-header">
        <div>
          <h2>{recipe.name}</h2>
        </div>
        <div className="recipe-preview-controls">
          <label className="target-yield-field">
            <span>{t("Target yield")}</span>
            <span className="target-yield-input-row">
              <input
                type="text"
                inputMode="decimal"
                value={targetYieldText}
                aria-label={t("Target yield")}
                onChange={(event) => updateTargetYield(event.target.value)}
              />
              <span>{getTargetYieldSuffix(targetYield)}</span>
            </span>
          </label>
          <div className="table-actions recipe-preview-header-actions">
            <button type="button" aria-label={t("Edit")} title={t("Edit")} onClick={() => onEdit(recipe)}>
              <Pencil size={16} aria-hidden="true" /> <span className="recipe-action-label">{t("Edit")}</span>
            </button>
            <button type="button" className="danger" aria-label={t("Delete")} title={t("Delete")} onClick={() => onDelete(recipe)}>
              <X size={16} aria-hidden="true" /> <span className="recipe-action-label">{t("Delete")}</span>
            </button>
            {onBack ? <MobileBackButton onClick={onBack} /> : null}
          </div>
        </div>
      </div>
      {previewWarnings.length > 0 ? (
        <div className="recipe-preview-warning">
          <WarningList key={recipe.id} warnings={previewWarnings} collapsible />
        </div>
      ) : null}
      <RecipePrintView
        recipe={displayRecipe}
        ingredients={ingredients}
        recipes={recipes}
        stats={printStats}
        className="recipe-print-preview"
        includeSubRecipes={includeSubRecipes}
      />
    </aside>
  );
}

function cloneYield(yieldDefinition: YieldDefinition): YieldDefinition {
  return JSON.parse(JSON.stringify(yieldDefinition)) as YieldDefinition;
}

function formatTargetYieldInput(yieldDefinition: YieldDefinition) {
  switch (yieldDefinition.type) {
    case "count":
    case "mass":
    case "volume":
    case "servings":
      return String(yieldDefinition.amount);
    case "moldArea":
      return yieldDefinition.shape === "circle"
        ? String(yieldDefinition.circle?.diameter ?? 0)
        : `${yieldDefinition.rectangle?.width ?? 0} x ${yieldDefinition.rectangle?.length ?? 0}`;
    case "moldVolume":
      return yieldDefinition.shape === "cylinder"
        ? `${yieldDefinition.cylinder?.diameter ?? 0} x ${yieldDefinition.cylinder?.height ?? 0}`
        : `${yieldDefinition.rectangularPrism?.width ?? 0} x ${
            yieldDefinition.rectangularPrism?.length ?? 0
          } x ${yieldDefinition.rectangularPrism?.height ?? 0}`;
  }
}

function applyTargetYieldInput(yieldDefinition: YieldDefinition, value: string): YieldDefinition {
  const numbers = parseTargetYieldNumbers(value);
  const firstValue = numbers[0] ?? 0;

  switch (yieldDefinition.type) {
    case "count":
    case "mass":
    case "volume":
    case "servings":
      return { ...yieldDefinition, amount: firstValue };
    case "moldArea":
      if (yieldDefinition.shape === "circle") {
        return {
          ...yieldDefinition,
          circle: {
            diameter: firstValue,
            unit: yieldDefinition.circle?.unit ?? "cm",
          },
        };
      }

      return {
        ...yieldDefinition,
        rectangle: {
          width: firstValue,
          length: numbers[1] ?? 0,
          unit: yieldDefinition.rectangle?.unit ?? "cm",
        },
      };
    case "moldVolume":
      if (yieldDefinition.shape === "cylinder") {
        return {
          ...yieldDefinition,
          cylinder: {
            diameter: firstValue,
            height: numbers[1] ?? 0,
            unit: yieldDefinition.cylinder?.unit ?? "cm",
          },
        };
      }

      return {
        ...yieldDefinition,
        rectangularPrism: {
          width: firstValue,
          length: numbers[1] ?? 0,
          height: numbers[2] ?? 0,
          unit: yieldDefinition.rectangularPrism?.unit ?? "cm",
        },
      };
  }
}

function parseTargetYieldNumbers(value: string) {
  return value
    .split(/[xX×*,;]+|\s+by\s+/)
    .map((part) => Number(part.trim()))
    .filter((number) => Number.isFinite(number));
}

function getTargetYieldSuffix(yieldDefinition: YieldDefinition) {
  switch (yieldDefinition.type) {
    case "count":
    case "servings":
      return yieldDefinition.label;
    case "mass":
    case "volume":
      return yieldDefinition.unit;
    case "moldArea":
      return yieldDefinition.shape === "circle"
        ? `${yieldDefinition.circle?.unit ?? "cm"} diameter`
        : `${yieldDefinition.rectangle?.unit ?? "cm"} width x length`;
    case "moldVolume":
      return yieldDefinition.shape === "cylinder"
        ? `${yieldDefinition.cylinder?.unit ?? "cm"} diameter x height`
        : `${yieldDefinition.rectangularPrism?.unit ?? "cm"} width x length x height`;
  }
}

function getCostPerOutput(
  targetYield: YieldDefinition,
  costResult: ReturnType<typeof calculateRecipeCost>,
  t: (key: string) => string,
) {
  if (costResult.totalCost === null || !costResult.currency) {
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
