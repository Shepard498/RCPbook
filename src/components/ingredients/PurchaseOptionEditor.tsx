import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../app/i18n";
import { Save } from "lucide-react";
import { db } from "../../db/db";
import type { Ingredient, PurchaseOption } from "../../domain/ingredients/ingredientTypes";
import { calculatePricePerBaseUnit } from "../../domain/ingredients/priceMath";
import { formatDate, todayIso } from "../../utils/dates";
import { createId } from "../../utils/ids";
import { formatCurrency, normalizeCurrency } from "../../utils/numbers";
import { MobileBackButton } from "../common/MobileBackButton";
import { NumberInput } from "../common/NumberInput";
import { UnitSelect } from "../common/UnitSelect";
import { WarningList } from "../common/WarningList";

interface PurchaseOptionEditorProps {
  ingredient: Ingredient;
  option: PurchaseOption | null;
  isFirstOption: boolean;
  onBack?: () => void;
  onSaved: () => void;
  onCancel: () => void;
}

export function PurchaseOptionEditor({
  ingredient,
  option,
  isFirstOption,
  onBack,
  onSaved,
  onCancel,
}: PurchaseOptionEditorProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<PurchaseOption>(() => createDraft(ingredient, option, isFirstOption));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(createDraft(ingredient, option, isFirstOption));
  }, [ingredient, isFirstOption, option]);

  const priceResult = useMemo(() => calculatePricePerBaseUnit(ingredient, draft), [draft, ingredient]);
  const warnings = [
    ...(priceResult.reason ? [priceResult.reason] : []),
    ...priceResult.warnings,
  ];
  const title = option ? t("Edit purchase option") : t("Add option");

  async function saveOption() {
    setIsSaving(true);

    const now = todayIso();
    const normalizedOption = normalizeOption(draft, ingredient.id, now);

    try {
      await db.transaction("rw", db.purchaseOptions, async () => {
        if (normalizedOption.isPreferred) {
          const existingOptions = await db.purchaseOptions.where("ingredientId").equals(ingredient.id).toArray();
          const optionsToUpdate = existingOptions
            .filter((existingOption) => existingOption.id !== normalizedOption.id && existingOption.isPreferred)
            .map((existingOption) => ({
              ...existingOption,
              isPreferred: false,
              lastUpdated: now,
              updatedAt: now,
            }));

          if (optionsToUpdate.length > 0) {
            await db.purchaseOptions.bulkPut(optionsToUpdate);
          }
        }

        await db.purchaseOptions.put(normalizedOption);
      });

      onSaved();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <aside className="panel" aria-label={title}>
      <div className="panel-header">
        {onBack ? <MobileBackButton onClick={onBack} /> : null}
        <div>
          <p className="eyebrow">{ingredient.name}</p>
          <h2>{title}</h2>
        </div>
        <WarningList warnings={warnings} />
      </div>

      <div className="panel-body">
        <div className="form-grid">
          <label>
            {t("Amount")}
            <NumberInput
              min={0}
              value={draft.amount}
              onValueChange={(amount) => setDraft({ ...draft, amount })}
            />
          </label>

          <label>
            {t("Unit")}
            <UnitSelect value={draft.unit} onChange={(unit) => setDraft({ ...draft, unit })} />
          </label>

          <label>
            {t("Price")}
            <NumberInput
              min={0}
              step="0.01"
              value={draft.price}
              onValueChange={(price) => setDraft({ ...draft, price })}
            />
          </label>

          <label>
            {t("Currency")}
            <input
              value={draft.currency}
              placeholder="$"
              onChange={(event) => setDraft({ ...draft, currency: event.target.value })}
            />
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={Boolean(draft.isPreferred)}
              onChange={(event) => setDraft({ ...draft, isPreferred: event.target.checked })}
            />
            {t("Preferred")}
          </label>

          <label>
            {t("Supplier")}
            <input
              value={draft.supplier ?? ""}
              onChange={(event) => setDraft({ ...draft, supplier: event.target.value })}
            />
          </label>

          <label>
            {t("Brand")}
            <input
              value={draft.brand ?? ""}
              onChange={(event) => setDraft({ ...draft, brand: event.target.value })}
            />
          </label>

          <label className="full-width">
            {t("Reference URL")}
            <input
              value={draft.referenceUrl ?? ""}
              onChange={(event) => setDraft({ ...draft, referenceUrl: event.target.value })}
            />
          </label>

          <label className="full-width">
            {t("Notes")}
            <textarea
              value={draft.notes ?? ""}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </label>
        </div>

        <div className="detail-grid purchase-option-stats">
          <div>
            <span className="muted">{t("Last updated")}</span>
            <strong>{t(formatDate(draft.lastUpdated))}</strong>
          </div>
          <div>
            <span className="muted">{t("Current usable price")}</span>
            <strong>{formatPriceResult(priceResult, t)}</strong>
          </div>
        </div>
      </div>

      <div className="panel-footer">
        <div className="editor-actions">
          <button type="button" onClick={onCancel}>
            {t("Cancel")}
          </button>
          <button type="button" className="primary" disabled={isSaving} onClick={saveOption}>
            <Save size={16} aria-hidden="true" />
            {isSaving ? `${t("Saving")}...` : t("Save option")}
          </button>
        </div>
      </div>
    </aside>
  );
}

function createDraft(ingredient: Ingredient, option: PurchaseOption | null, isFirstOption: boolean): PurchaseOption {
  const now = todayIso();

  return option
    ? {
        ...option,
        currency: normalizeCurrency(option.currency),
      }
    : {
        id: createId(),
        ingredientId: ingredient.id,
        amount: 1,
        unit: ingredient.preferredUnit,
        price: 0,
        currency: "$",
        lastUpdated: now,
        isPreferred: isFirstOption,
        createdAt: now,
        updatedAt: now,
      };
}

function normalizeOption(option: PurchaseOption, ingredientId: string, now: string): PurchaseOption {
  return {
    ...option,
    ingredientId,
    amount: Number(option.amount),
    price: Number(option.price),
    currency: normalizeCurrency(option.currency),
    supplier: option.supplier?.trim() || undefined,
    brand: option.brand?.trim() || undefined,
    referenceUrl: option.referenceUrl?.trim() || undefined,
    notes: option.notes?.trim() || undefined,
    isPreferred: Boolean(option.isPreferred),
    lastUpdated: now,
    updatedAt: now,
  };
}

function formatPriceResult(
  result: ReturnType<typeof calculatePricePerBaseUnit>,
  t: (key: string) => string,
) {
  if (result.ok && result.pricePerBaseUnit !== null && result.currency) {
    return `${formatCurrency(result.pricePerBaseUnit, result.currency)}/${result.baseUnit}`;
  }

  return t("Invalid option");
}
