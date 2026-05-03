import { useEffect, useState } from "react";
import { useI18n } from "../../app/i18n";
import { useAppPreferences } from "../../app/preferences";
import type {
  Ingredient,
  PurchaseOption,
} from "../../domain/ingredients/ingredientTypes";
import { calculatePricePerBaseUnit } from "../../domain/ingredients/priceMath";
import { dateInputValueToIso, formatDate, todayIso, toDateInputValue } from "../../utils/dates";
import { createId } from "../../utils/ids";
import { formatCurrency, formatNumber } from "../../utils/numbers";
import { NumberInput } from "../common/NumberInput";
import { UnitSelect } from "../common/UnitSelect";

interface PurchaseOptionsTableProps {
  ingredient: Ingredient;
  options: PurchaseOption[];
  onChange: (options: PurchaseOption[]) => void;
}

export function PurchaseOptionsTable({ ingredient, options, onChange }: PurchaseOptionsTableProps) {
  const { t } = useI18n();
  const { confirmDeletes } = useAppPreferences();
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);

  useEffect(() => {
    if (expandedOptionId && !options.some((option) => option.id === expandedOptionId)) {
      setExpandedOptionId(null);
    }
  }, [expandedOptionId, options]);

  function addOption() {
    const now = todayIso();
    const nextOption: PurchaseOption = {
      id: createId(),
      ingredientId: ingredient.id,
      amount: 1,
      unit: ingredient.preferredUnit,
      price: 0,
      currency: "$",
      lastUpdated: now,
      isPreferred: options.length === 0,
      createdAt: now,
      updatedAt: now,
    };

    setExpandedOptionId(nextOption.id);
    onChange([
      ...options,
      nextOption,
    ]);
  }

  function updateOption(id: string, patch: Partial<PurchaseOption>) {
    onChange(
      options.map((option) => {
        if (option.id !== id) {
          return option;
        }

        return {
          ...option,
          ...patch,
          updatedAt: todayIso(),
        };
      }),
    );
  }

  function setPreferred(id: string, checked: boolean) {
    onChange(
      options.map((option) => ({
        ...option,
        isPreferred: checked ? option.id === id : option.id === id ? false : option.isPreferred,
        updatedAt: option.id === id ? todayIso() : option.updatedAt,
      })),
    );
  }

  function deleteOption(id: string) {
    if (confirmDeletes && !window.confirm(t("Delete purchase option? This cannot be undone."))) {
      return;
    }

    if (expandedOptionId === id) {
      setExpandedOptionId(null);
    }

    onChange(options.filter((option) => option.id !== id));
  }

  return (
    <section className="purchase-options">
      <div className="panel-header">
        <div>
          <h3>{t("Purchase options")}</h3>
        </div>
        <button type="button" onClick={addOption}>
          {t("Add option")}
        </button>
      </div>

      {options.length === 0 ? (
        <div className="empty-state">{t("No purchase options yet.")}</div>
      ) : (
        options.map((option) => {
          const priceResult = calculatePricePerBaseUnit(ingredient, option);
          const isExpanded = expandedOptionId === option.id;

          return (
            <div className="purchase-option-card" key={option.id}>
              <div className="purchase-option-summary">
                <button
                  type="button"
                  className="purchase-option-toggle"
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedOptionId(isExpanded ? null : option.id)}
                >
                  <span className="summary-main">
                    <span className="summary-title">
                      {t(getOptionTitle(option))}
                      {option.isPreferred ? <span className="badge neutral">{t("Preferred")}</span> : null}
                    </span>
                    <span className="summary-detail">
                      {formatNumber(option.amount)} {option.unit} {t("for")}{" "}
                      {formatCurrency(option.price, option.currency)} - {t(formatDate(option.lastUpdated))}
                    </span>
                  </span>
                  <span className={`summary-price ${priceResult.ok ? "" : "invalid"}`}>
                    {priceResult.ok && priceResult.pricePerBaseUnit !== null && priceResult.currency
                      ? `${formatCurrency(priceResult.pricePerBaseUnit, priceResult.currency)}/${priceResult.baseUnit}`
                      : t("Invalid option")}
                  </span>
                </button>

                <div className="summary-actions">
                  <button
                    type="button"
                    onClick={() => setExpandedOptionId(isExpanded ? null : option.id)}
                  >
                    {isExpanded ? t("Done") : t("Edit")}
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    aria-label={t("Delete purchase option")}
                    title={t("Delete purchase option")}
                    onClick={() => deleteOption(option.id)}
                  >
                    X
                  </button>
                </div>
              </div>

              {isExpanded ? (
                <div className="purchase-option-fields">
                  <label>
                    {t("Amount")}
                    <NumberInput
                      min={0}
                      value={option.amount}
                      onValueChange={(amount) => updateOption(option.id, { amount })}
                    />
                  </label>

                  <label>
                    {t("Unit")}
                    <UnitSelect value={option.unit} onChange={(unit) => updateOption(option.id, { unit })} />
                  </label>

                  <label>
                    {t("Price")}
                    <NumberInput
                      min={0}
                      step="0.01"
                      value={option.price}
                      onValueChange={(price) => updateOption(option.id, { price })}
                    />
                  </label>

                  <label>
                    {t("Currency")}
                    <input
                      value={option.currency}
                      placeholder="$"
                      onChange={(event) => updateOption(option.id, { currency: event.target.value })}
                    />
                  </label>

                  <label>
                    {t("Last updated")}
                    <input
                      type="date"
                      value={toDateInputValue(option.lastUpdated)}
                      onChange={(event) =>
                        updateOption(option.id, { lastUpdated: dateInputValueToIso(event.target.value) })
                      }
                    />
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={Boolean(option.isPreferred)}
                      onChange={(event) => setPreferred(option.id, event.target.checked)}
                    />
                    {t("Preferred")}
                  </label>

                  <label>
                    {t("Supplier")}
                    <input
                      value={option.supplier ?? ""}
                      onChange={(event) => updateOption(option.id, { supplier: event.target.value })}
                    />
                  </label>

                  <label>
                    {t("Brand")}
                    <input
                      value={option.brand ?? ""}
                      onChange={(event) => updateOption(option.id, { brand: event.target.value })}
                    />
                  </label>

                  <label className="full-width">
                    {t("Reference URL")}
                    <input
                      value={option.referenceUrl ?? ""}
                      onChange={(event) => updateOption(option.id, { referenceUrl: event.target.value })}
                    />
                  </label>

                  <label className="full-width">
                    {t("Notes")}
                    <textarea
                      value={option.notes ?? ""}
                      onChange={(event) => updateOption(option.id, { notes: event.target.value })}
                    />
                  </label>

                  <div className="full-width">
                    {priceResult.ok && priceResult.pricePerBaseUnit !== null && priceResult.currency ? (
                      <span className="muted">
                        {formatCurrency(priceResult.pricePerBaseUnit, priceResult.currency)}/
                        {priceResult.baseUnit} {t("from")} {formatNumber(option.amount)} {option.unit}
                      </span>
                    ) : (
                      <span className="validation-message">{t(priceResult.reason ?? "")}</span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </section>
  );
}

function getOptionTitle(option: PurchaseOption) {
  const titleParts = [option.supplier, option.brand].filter(Boolean);

  return titleParts.length > 0 ? titleParts.join(" - ") : "Purchase option";
}
