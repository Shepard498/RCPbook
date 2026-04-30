import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../app/i18n";
import { db } from "../../db/db";
import type { Ingredient } from "../../domain/ingredients/ingredientTypes";
import type { CostResult } from "../../domain/recipes/recipeCosting";
import type { Recipe } from "../../domain/recipes/recipeTypes";
import type { ScaledRecipe } from "../../domain/recipes/scaling";
import { formatYield } from "../../domain/recipes/yieldFormatting";
import { formatPracticalAmount } from "../../utils/amountFormatting";
import { formatCurrency, formatNumber } from "../../utils/numbers";
import { WarningList } from "../common/WarningList";

interface ScaledRecipeViewProps {
  scaledRecipe: ScaledRecipe;
  ingredients: Ingredient[];
  recipes: Recipe[];
  costResult: CostResult;
}

export function ScaledRecipeView({ scaledRecipe, ingredients, recipes, costResult }: ScaledRecipeViewProps) {
  const { t } = useI18n();
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const allWarnings = Array.from(new Set([...scaledRecipe.warnings, ...costResult.warnings]));
  const costPerOutput = getCostPerOutput(scaledRecipe, costResult, t);
  const sortedSteps = useMemo(
    () => [...scaledRecipe.recipe.procedureSteps].sort((a, b) => a.sortOrder - b.sortOrder),
    [scaledRecipe.recipe.procedureSteps],
  );
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;
    const createdUrls: string[] = [];
    const imageBlobIds = sortedSteps
      .map((step) => step.imageBlobId)
      .filter((imageBlobId): imageBlobId is string => Boolean(imageBlobId));

    if (imageBlobIds.length === 0) {
      setImageUrls({});
      return () => undefined;
    }

    async function loadImages() {
      const images = await db.imageBlobs.bulkGet(imageBlobIds);
      const nextImageUrls: Record<string, string> = {};

      images.forEach((image, index) => {
        if (!image) {
          return;
        }

        const objectUrl = URL.createObjectURL(image.blob);
        createdUrls.push(objectUrl);
        nextImageUrls[imageBlobIds[index]] = objectUrl;
      });

      if (isMounted) {
        setImageUrls(nextImageUrls);
      } else {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
      }
    }

    loadImages().catch(() => {
      if (isMounted) {
        setImageUrls({});
      }
    });

    return () => {
      isMounted = false;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [sortedSteps]);

  return (
    <section className="panel scaled-recipe-view">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{t("Scaled recipe")}</p>
          <h2>{scaledRecipe.recipe.name}</h2>
        </div>
        <button type="button" onClick={() => window.print()}>
          {t("Print")}
        </button>
      </div>

      <div className="panel-body scaled-recipe-body">
        <div className="scaled-summary">
          <div>
            <span className="muted">{t("Original")}</span>
            <strong>{formatYield(scaledRecipe.originalYield, t)}</strong>
          </div>
          <div>
            <span className="muted">{t("Target")}</span>
            <strong>{formatYield(scaledRecipe.targetYield, t)}</strong>
          </div>
          <div>
            <span className="muted">{t("Scale factor")}</span>
            <strong>{formatNumber(scaledRecipe.scaleFactor, 3)}</strong>
          </div>
          <div>
            <span className="muted">{t("Total cost")}</span>
            <strong>
              {costResult.totalCost !== null && costResult.currency
                ? formatCurrency(costResult.totalCost, costResult.currency)
                : t("Incomplete")}
            </strong>
          </div>
          <div>
            <span className="muted">{t("Cost per output")}</span>
            <strong>{costPerOutput}</strong>
          </div>
        </div>

        <div className="scaled-warning-row">
          <WarningList warnings={allWarnings} />
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Ingredient")}</th>
                <th>{t("Scaled amount")}</th>
                <th>{t("Estimated cost")}</th>
                <th>{t("Warnings")}</th>
              </tr>
            </thead>
            <tbody>
              {[...scaledRecipe.recipe.lines]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((line) => {
                  const ingredientName = line.ingredientId
                    ? ingredientById.get(line.ingredientId)?.name ?? "Unknown ingredient"
                    : recipeById.get(line.subRecipeId ?? "")?.name ?? t("Sub-recipe");
                  const lineCost = costResult.lineCosts.find((cost) => cost.lineId === line.id);

                  return (
                    <tr key={line.id}>
                      <td>
                        <strong>{ingredientName}</strong>
                        {line.notes ? <div className="muted">{line.notes}</div> : null}
                      </td>
                      <td>
                        {formatPracticalAmount(line.amount, line.unit)}
                      </td>
                      <td>
                        {lineCost?.cost !== null && lineCost?.currency
                          ? formatCurrency(lineCost.cost, lineCost.currency)
                          : t("Incomplete")}
                      </td>
                      <td>
                        <WarningList warnings={lineCost?.warnings ?? []} />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {scaledRecipe.recipe.procedureSteps.length > 0 ? (
          <section className="scaled-procedure">
            <h3>{t("Procedure")}</h3>
            <ol>
              {sortedSteps.map((step) => (
                <li key={step.id}>
                  <p className="recipe-print-step-text">{step.text}</p>
                  {step.time || step.timeMinutes || step.temperature ? (
                    <p className="muted">
                      {step.time
                        ? `${step.time.value} ${step.time.unit}`
                        : step.timeMinutes
                          ? `${step.timeMinutes} min`
                          : ""}
                      {(step.time || step.timeMinutes) && step.temperature ? " - " : ""}
                      {step.temperature ? `${step.temperature.value}${step.temperature.unit}` : ""}
                    </p>
                  ) : null}
                  {step.imageBlobId && imageUrls[step.imageBlobId] ? (
                    <img
                      className="recipe-print-step-image"
                      src={imageUrls[step.imageBlobId]}
                      alt={`Step ${step.sortOrder + 1}`}
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function getCostPerOutput(scaledRecipe: ScaledRecipe, costResult: CostResult, t: (key: string) => string) {
  if (costResult.totalCost === null || !costResult.currency) {
    return t("Incomplete");
  }

  const targetYield = scaledRecipe.targetYield;

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
