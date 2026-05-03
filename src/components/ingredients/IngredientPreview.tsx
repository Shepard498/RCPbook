import { useI18n } from "../../app/i18n";
import type {
  Ingredient,
  IngredientCategory,
  PurchaseOption,
} from "../../domain/ingredients/ingredientTypes";
import {
  calculatePricePerBaseUnit,
  describePriceSummary,
  getIngredientPriceSummary,
} from "../../domain/ingredients/priceMath";
import { formatDate } from "../../utils/dates";
import { formatCurrency, formatNumber } from "../../utils/numbers";
import { MobileBackButton } from "../common/MobileBackButton";
import { WarningList } from "../common/WarningList";

interface IngredientPreviewProps {
  ingredient: Ingredient;
  categories: IngredientCategory[];
  purchaseOptions: PurchaseOption[];
  eyebrowLabel?: string;
  onBack?: () => void;
  onEdit: (ingredient: Ingredient) => void;
  onDelete: (ingredient: Ingredient) => void;
}

export function IngredientPreview({
  ingredient,
  categories,
  purchaseOptions,
  eyebrowLabel = "Ingredient",
  onBack,
  onEdit,
  onDelete,
}: IngredientPreviewProps) {
  const { t } = useI18n();
  const category = ingredient.categoryId
    ? categories.find((candidate) => candidate.id === ingredient.categoryId)
    : undefined;
  const priceSummary = getIngredientPriceSummary(ingredient, purchaseOptions);

  return (
    <aside className="panel ingredient-preview-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{t(eyebrowLabel)}</p>
          <h2>{ingredient.name}</h2>
        </div>
        <div className="table-actions detail-header-actions">
          <button type="button" onClick={() => onEdit(ingredient)}>
            {t("Edit")}
          </button>
          <button type="button" className="danger" onClick={() => onDelete(ingredient)}>
            {t("Delete")}
          </button>
        </div>
        {onBack ? <MobileBackButton onClick={onBack} /> : null}
      </div>

      <div className="panel-body ingredient-preview-body">
        <div className="detail-grid">
          <div>
            <span className="muted">{t("Category")}</span>
            <strong>{category ? t(category.name) : t("None")}</strong>
          </div>
          <div>
            <span className="muted">{t("Preferred unit")}</span>
            <strong>{ingredient.preferredUnit}</strong>
          </div>
          <div>
            <span className="muted">{t("Current usable price")}</span>
            <strong>{t(describePriceSummary(priceSummary))}</strong>
          </div>
          <div>
            <span className="muted">{t("Last updated")}</span>
            <strong>{t(formatDate(priceSummary.lastUpdated ?? undefined))}</strong>
          </div>
          <div>
            <span className="muted">{t("Density")}</span>
            <strong>
              {ingredient.density
                ? `${formatNumber(ingredient.density.value)} ${ingredient.density.unit}`
                : t("Not set")}
            </strong>
          </div>
          <div>
            <span className="muted">{t("Unit weight")}</span>
            <strong>
              {ingredient.unitWeight
                ? `${formatNumber(ingredient.unitWeight.value)} ${ingredient.unitWeight.unit}`
                : t("Not set")}
            </strong>
          </div>
        </div>

        <div className="scaled-warning-row">
          <WarningList warnings={priceSummary.warnings} />
        </div>

        {ingredient.notes ? (
          <section className="preview-section">
            <h3>{t("Notes")}</h3>
            <p>{ingredient.notes}</p>
          </section>
        ) : null}

        <section className="preview-section">
          <h3>{t("Purchase options")}</h3>
          {purchaseOptions.length === 0 ? (
            <div className="empty-state">{t("No purchase options yet.")}</div>
          ) : (
            <div className="purchase-option-preview-list">
              {purchaseOptions.map((option) => {
                const priceResult = calculatePricePerBaseUnit(ingredient, option);

                return (
                  <div className="purchase-option-card" key={option.id}>
                    <div className="purchase-option-summary">
                      <div className="summary-main">
                        <div className="summary-title">
                          {getOptionTitle(option)}
                          {option.isPreferred ? <span className="badge neutral">{t("Preferred")}</span> : null}
                        </div>
                        <div className="summary-detail">
                          {formatNumber(option.amount)} {option.unit} {t("for")}{" "}
                          {formatCurrency(option.price, option.currency)} -{" "}
                          {t(formatDate(option.lastUpdated))}
                        </div>
                      </div>
                      <div className={`summary-price ${priceResult.ok ? "" : "invalid"}`}>
                        {priceResult.ok && priceResult.pricePerBaseUnit !== null && priceResult.currency
                          ? `${formatCurrency(priceResult.pricePerBaseUnit, priceResult.currency)}/${
                              priceResult.baseUnit
                            }`
                          : t("Invalid option")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}

function getOptionTitle(option: PurchaseOption) {
  const titleParts = [option.supplier, option.brand].filter(Boolean);

  return titleParts.length > 0 ? titleParts.join(" - ") : "Purchase option";
}
