import { useI18n } from "../../app/i18n";
import type { Recipe } from "../../domain/recipes/recipeTypes";
import { formatYield } from "../../domain/recipes/yieldFormatting";
import { formatDate } from "../../utils/dates";

interface RecipeListProps {
  recipes: Recipe[];
  selectedRecipeId?: string;
  onSelect: (recipe: Recipe) => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
}

export function RecipeList({ recipes, selectedRecipeId, onSelect, onEdit, onDelete }: RecipeListProps) {
  const { t } = useI18n();

  if (recipes.length === 0) {
    return <div className="empty-state">{t("No recipes match the current search.")}</div>;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{t("Name")}</th>
            <th>{t("Yield")}</th>
            <th>{t("Updated")}</th>
            <th className="mobile-hidden-column" aria-label={t("Actions")} />
          </tr>
        </thead>
        <tbody>
          {recipes.map((recipe) => (
            <tr
              key={recipe.id}
              className={`selectable-row ${recipe.id === selectedRecipeId ? "selected-row" : ""}`}
              onClick={() => onSelect(recipe)}
            >
              <td>
                <div className="ingredient-name">{recipe.name}</div>
                {recipe.isSubRecipe ? <span className="badge neutral">{t("Sub-recipe")}</span> : null}
                {recipe.description ? <div className="muted">{recipe.description}</div> : null}
              </td>
              <td>{formatYield(recipe.yield, t)}</td>
              <td>{t(formatDate(recipe.updatedAt))}</td>
              <td className="mobile-hidden-column">
                <div className="inline-actions">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(recipe);
                    }}
                  >
                    {t("Edit")}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(recipe);
                    }}
                  >
                    {t("Delete")}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
