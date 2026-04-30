import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../app/i18n";
import { db } from "../../db/db";
import type { Ingredient } from "../../domain/ingredients/ingredientTypes";
import type { Recipe } from "../../domain/recipes/recipeTypes";
import { formatYield } from "../../domain/recipes/yieldFormatting";
import { formatPracticalAmount } from "../../utils/amountFormatting";

export interface RecipePrintStats {
  totalCost: string;
  costPerOutput: string;
}

interface RecipePrintViewProps {
  recipe: Recipe;
  ingredients: Ingredient[];
  recipes?: Recipe[];
  stats?: RecipePrintStats;
  className?: string;
}

export function RecipePrintView({ recipe, ingredients, recipes = [], stats, className }: RecipePrintViewProps) {
  const { t } = useI18n();
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const recipeById = new Map(recipes.map((availableRecipe) => [availableRecipe.id, availableRecipe]));
  const sortedSteps = useMemo(
    () => [...recipe.procedureSteps].sort((a, b) => a.sortOrder - b.sortOrder),
    [recipe.procedureSteps],
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
    <article className={`recipe-print ${className ?? ""}`}>
      <div className="recipe-print-heading">
        <div className="recipe-print-title">
          <h1>{recipe.name || t("Untitled recipe")}</h1>
          {recipe.description ? <p>{recipe.description}</p> : null}
          <p>
            <strong>{t("Yield")}:</strong> {formatYield(recipe.yield, t)}
          </p>
        </div>

        {stats ? (
          <aside className="recipe-print-stats" aria-label={t("Recipe stats")}>
            <div>
              <span>{t("Total cost")}</span>
              <strong>{stats.totalCost}</strong>
            </div>
            <div>
              <span>{t("Cost per output")}</span>
              <strong>{stats.costPerOutput}</strong>
            </div>
          </aside>
        ) : null}
      </div>

      <h2>{t("Ingredients")}</h2>
      <ul>
        {[...recipe.lines]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((line) => (
            <li key={line.id}>
              {formatPracticalAmount(line.amount, line.unit)}{" "}
              {line.itemType === "ingredient"
                ? ingredientById.get(line.ingredientId ?? "")?.name ?? t("Unknown ingredient")
                : recipeById.get(line.subRecipeId ?? "")?.name ?? t("Sub-recipe")}
              {line.notes ? `, ${line.notes}` : ""}
            </li>
          ))}
      </ul>

      <h2>{t("Procedure")}</h2>
      <ol>
        {sortedSteps.map((step) => (
          <li key={step.id}>
            <p className="recipe-print-step-text">{step.text}</p>
            {step.time || step.timeMinutes || step.temperature ? (
              <p>
                {step.time ? `${step.time.value} ${step.time.unit}` : step.timeMinutes ? `${step.timeMinutes} min` : ""}
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

      {recipe.notes ? (
        <>
          <h2>{t("Notes")}</h2>
          <p>{recipe.notes}</p>
        </>
      ) : null}
    </article>
  );
}
