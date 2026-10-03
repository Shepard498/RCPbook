import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../app/i18n";
import { db } from "../../db/db";
import type { Ingredient } from "../../domain/ingredients/ingredientTypes";
import type { ProcedureStep, Recipe } from "../../domain/recipes/recipeTypes";
import { scaleRecipe } from "../../domain/recipes/scaling";
import { createSubRecipeTargetYield } from "../../domain/recipes/subRecipeMath";
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
  includeSubRecipes?: boolean;
}

export function RecipePrintView({
  recipe,
  ingredients,
  recipes = [],
  stats,
  className,
  includeSubRecipes = false,
}: RecipePrintViewProps) {
  const { t } = useI18n();
  const ingredientById = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [ingredients],
  );
  const recipeById = useMemo(
    () => new Map(recipes.map((availableRecipe) => [availableRecipe.id, availableRecipe])),
    [recipes],
  );
  const sortedSteps = useMemo(
    () => sortProcedureSteps(recipe.procedureSteps),
    [recipe.procedureSteps],
  );
  const subRecipeInstructionSections = useMemo(
    () => (includeSubRecipes ? collectSubRecipeInstructionSections(recipe, recipeById) : []),
    [includeSubRecipes, recipe, recipeById],
  );
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;
    const createdUrls: string[] = [];
    const imageBlobIds = [...sortedSteps, ...subRecipeInstructionSections.flatMap((section) => section.steps)]
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
  }, [sortedSteps, subRecipeInstructionSections]);

  function renderProcedureStep(step: ProcedureStep) {
    return (
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
    );
  }

  function renderRecipeLines(sourceRecipe: Recipe) {
    return sortRecipeLines(sourceRecipe.lines).map((line) => (
      <li key={line.id}>
        {formatPracticalAmount(line.amount, line.unit)}{" "}
        {line.itemType === "ingredient"
          ? ingredientById.get(line.ingredientId ?? "")?.name ?? t("Unknown ingredient")
          : recipeById.get(line.subRecipeId ?? "")?.name ?? t("Sub-recipe")}
        {line.notes ? `, ${line.notes}` : ""}
      </li>
    ));
  }

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
      <ul className="recipe-print-ingredients">{renderRecipeLines(recipe)}</ul>

      <h2>{t("Procedure")}</h2>
      <ol>
        {sortedSteps.map(renderProcedureStep)}
      </ol>

      {subRecipeInstructionSections.length > 0 ? (
        <section className="recipe-print-subrecipes">
          <h2>{t("Sub-recipe instructions")}</h2>
          {subRecipeInstructionSections.map((section) => (
            <section className="recipe-print-subrecipe" key={section.key}>
              <h3>{section.recipe.name}</h3>
              <p className="recipe-print-subrecipe-yield">
                <strong>{t("Yield")}:</strong> {formatYield(section.recipe.yield, t)}
              </p>
              {section.recipe.lines.length > 0 ? (
                <>
                  <h4>{t("Ingredients")}</h4>
                  <ul className="recipe-print-ingredients">{renderRecipeLines(section.recipe)}</ul>
                </>
              ) : null}
              {section.steps.length > 0 ? (
                <>
                  <h4>{t("Procedure")}</h4>
                  <ol>{section.steps.map(renderProcedureStep)}</ol>
                </>
              ) : null}
            </section>
          ))}
        </section>
      ) : null}

      {recipe.notes ? (
        <>
          <h2>{t("Notes")}</h2>
          <p>{recipe.notes}</p>
        </>
      ) : null}
    </article>
  );
}

interface SubRecipeInstructionSection {
  key: string;
  recipe: Recipe;
  steps: ProcedureStep[];
}

function collectSubRecipeInstructionSections(recipe: Recipe, recipeById: Map<string, Recipe>) {
  const sections: SubRecipeInstructionSection[] = [];

  function visit(sourceRecipe: Recipe, recipePath: string[], sectionPath: string) {
    sortRecipeLines(sourceRecipe.lines).forEach((line) => {
      if (line.itemType !== "recipe" || !line.subRecipeId || recipePath.includes(line.subRecipeId)) {
        return;
      }

      const subRecipe = recipeById.get(line.subRecipeId);

      if (!subRecipe) {
        return;
      }

      const scaledSubRecipe = scaleSubRecipeForLine(subRecipe, line);
      const nextSectionPath = `${sectionPath}/${line.id}:${subRecipe.id}`;

      const steps = sortProcedureSteps(scaledSubRecipe.procedureSteps);
      if (scaledSubRecipe.lines.length > 0 || steps.length > 0) {
        sections.push({ key: nextSectionPath, recipe: scaledSubRecipe, steps });
      }

      visit(scaledSubRecipe, [...recipePath, subRecipe.id], nextSectionPath);
    });
  }

  visit(recipe, [recipe.id], recipe.id);

  return sections;
}

function scaleSubRecipeForLine(subRecipe: Recipe, line: Recipe["lines"][number]) {
  const targetYield = createSubRecipeTargetYield(subRecipe, line);

  if (!targetYield.ok) {
    return subRecipe;
  }

  const scaledSubRecipe = scaleRecipe(subRecipe, targetYield.targetYield);

  if ("ok" in scaledSubRecipe) {
    return subRecipe;
  }

  return scaledSubRecipe.recipe;
}

function sortProcedureSteps(steps: ProcedureStep[]) {
  return [...steps].sort((a, b) => a.sortOrder - b.sortOrder);
}

function sortRecipeLines(lines: Recipe["lines"]) {
  return [...lines].sort((a, b) => a.sortOrder - b.sortOrder);
}
