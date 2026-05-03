import type {
  Ingredient,
  IngredientCategory,
  PurchaseOption,
} from "../../domain/ingredients/ingredientTypes";
import { useI18n } from "../../app/i18n";
import { describePriceSummary, getIngredientPriceSummary } from "../../domain/ingredients/priceMath";
import { formatDate } from "../../utils/dates";
import { WarningList } from "../common/WarningList";

interface IngredientListProps {
  ingredients: Ingredient[];
  categories: IngredientCategory[];
  purchaseOptionsByIngredient: Map<string, PurchaseOption[]>;
  selectedIngredientId?: string;
  emptyMessage?: string;
  onSelect: (ingredient: Ingredient) => void;
  onEdit: (ingredient: Ingredient) => void;
  onDelete: (ingredient: Ingredient) => void;
}

export function IngredientList({
  ingredients,
  categories,
  purchaseOptionsByIngredient,
  selectedIngredientId,
  emptyMessage = "No ingredients match the current search.",
  onSelect,
  onEdit,
  onDelete,
}: IngredientListProps) {
  const { t } = useI18n();
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  if (ingredients.length === 0) {
    return <div className="empty-state">{t(emptyMessage)}</div>;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{t("Name")}</th>
            <th className="mobile-hidden-column">{t("Category")}</th>
            <th className="mobile-hidden-column">{t("Preferred unit")}</th>
            <th className="mobile-hidden-column">{t("Current usable price")}</th>
            <th className="mobile-hidden-column">{t("Last updated")}</th>
            <th>{t("Warnings")}</th>
            <th className="mobile-hidden-column" aria-label={t("Actions")} />
          </tr>
        </thead>
        <tbody>
          {ingredients.map((ingredient) => {
            const options = purchaseOptionsByIngredient.get(ingredient.id) ?? [];
            const priceSummary = getIngredientPriceSummary(ingredient, options);

            return (
              <tr
                key={ingredient.id}
                className={`selectable-row ${ingredient.id === selectedIngredientId ? "selected-row" : ""}`}
                onClick={() => onSelect(ingredient)}
              >
                <td>
                  <div className="ingredient-name">{ingredient.name}</div>
                  {ingredient.notes ? <div className="muted">{ingredient.notes}</div> : null}
                </td>
                <td className="mobile-hidden-column">
                  {ingredient.categoryId
                    ? t(categoryById.get(ingredient.categoryId)?.name ?? "Unknown")
                    : t("None")}
                </td>
                <td className="mobile-hidden-column">{ingredient.preferredUnit}</td>
                <td className="price-cell mobile-hidden-column">{t(describePriceSummary(priceSummary))}</td>
                <td className="mobile-hidden-column">{t(formatDate(priceSummary.lastUpdated ?? undefined))}</td>
                <td>
                  <WarningList warnings={priceSummary.warnings} />
                </td>
                <td className="mobile-hidden-column">
                  <div className="inline-actions">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(ingredient);
                      }}
                    >
                      {t("Edit")}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(ingredient);
                      }}
                    >
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
