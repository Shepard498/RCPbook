import { useEffect, useState } from "react";
import { useI18n } from "../../app/i18n";
import { Save } from "lucide-react";
import { db } from "../../db/db";
import type {
  DensityUnit,
  Ingredient,
  IngredientCategory,
  UnitWeightUnit,
} from "../../domain/ingredients/ingredientTypes";
import type { UnitId } from "../../domain/units/unitTypes";
import { todayIso } from "../../utils/dates";
import { createId } from "../../utils/ids";
import { parseNumberInput } from "../../utils/numbers";
import { MobileBackButton } from "../common/MobileBackButton";
import { UnitSelect } from "../common/UnitSelect";

interface IngredientEditorProps {
  ingredient: Ingredient | null;
  categories: IngredientCategory[];
  defaultCategoryId?: string;
  isCategoryLocked?: boolean;
  addTitle?: string;
  saveLabel?: string;
  onBack?: () => void;
  onSaved: (ingredient: Ingredient) => void;
  onCancel: () => void;
}

interface IngredientDraft {
  id: string;
  name: string;
  categoryId: string;
  preferredUnit: UnitId;
  notes: string;
  createdAt: string;
}

const densityUnits: DensityUnit[] = ["g/mL", "kg/L", "g/cm3"];
const unitWeightUnits: UnitWeightUnit[] = ["g/unit", "kg/unit"];

export function IngredientEditor({
  ingredient,
  categories,
  defaultCategoryId,
  isCategoryLocked = false,
  addTitle,
  saveLabel,
  onBack,
  onSaved,
  onCancel,
}: IngredientEditorProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<IngredientDraft>(() => createDraft(ingredient, defaultCategoryId));
  const [densityValue, setDensityValue] = useState("");
  const [densityUnit, setDensityUnit] = useState<DensityUnit>("g/mL");
  const [unitWeightValue, setUnitWeightValue] = useState("");
  const [unitWeightUnit, setUnitWeightUnit] = useState<UnitWeightUnit>("g/unit");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(createDraft(ingredient, defaultCategoryId));
    setDensityValue(ingredient?.density?.value.toString() ?? "");
    setDensityUnit(ingredient?.density?.unit ?? "g/mL");
    setUnitWeightValue(ingredient?.unitWeight?.value.toString() ?? "");
    setUnitWeightUnit(ingredient?.unitWeight?.unit ?? "g/unit");
  }, [defaultCategoryId, ingredient]);

  const title = ingredient ? t("Edit {name}", { name: ingredient.name }) : addTitle ?? t("Add ingredient");

  async function saveIngredient() {
    const name = draft.name.trim();

    if (!name) {
      window.alert(t("Ingredient name is required."));
      return;
    }

    setIsSaving(true);

    const now = todayIso();
    const normalizedIngredient: Ingredient = {
      ...buildIngredientFromDraft(
        {
          ...draft,
          name,
        },
        densityValue,
        densityUnit,
        unitWeightValue,
        unitWeightUnit,
      ),
      updatedAt: now,
    };

    try {
      await db.ingredients.put(normalizedIngredient);
      onSaved(normalizedIngredient);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <aside className="panel" aria-label={title}>
      <div className="panel-header">
        {onBack ? <MobileBackButton onClick={onBack} /> : null}
        <div>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="panel-body">
        <div className="form-grid">
          <label>
            {t("Name")}
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>

          {isCategoryLocked ? null : (
            <label>
              {t("Category")}
              <select
                value={draft.categoryId}
                onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
              >
                <option value="">{t("None")}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {t(category.name)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            {t("Preferred unit")}
            <UnitSelect
              value={draft.preferredUnit}
              onChange={(preferredUnit) => setDraft({ ...draft, preferredUnit })}
            />
          </label>

          <label>
            {t("Density")}
            <span className="field-pair">
              <input
                type="number"
                min="0"
                step="any"
                value={densityValue}
                onChange={(event) => setDensityValue(event.target.value)}
                placeholder={t("Optional")}
              />
              <select value={densityUnit} onChange={(event) => setDensityUnit(event.target.value as DensityUnit)}>
                {densityUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label>
            {t("Unit weight")}
            <span className="field-pair">
              <input
                type="number"
                min="0"
                step="any"
                value={unitWeightValue}
                onChange={(event) => setUnitWeightValue(event.target.value)}
                placeholder={t("Optional")}
              />
              <select
                value={unitWeightUnit}
                onChange={(event) => setUnitWeightUnit(event.target.value as UnitWeightUnit)}
              >
                {unitWeightUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <label className="full-width">
            {t("Notes")}
            <textarea
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </label>
        </div>

      </div>

      <div className="panel-footer">
        <div className="editor-actions">
          <button type="button" onClick={onCancel}>
            {t("Cancel")}
          </button>
          <button type="button" className="primary" disabled={isSaving} onClick={saveIngredient}>
            <Save size={16} aria-hidden="true" />
            {isSaving ? `${t("Saving")}...` : saveLabel ?? t("Save ingredient")}
          </button>
        </div>
      </div>
    </aside>
  );
}

function createDraft(ingredient: Ingredient | null, defaultCategoryId?: string): IngredientDraft {
  const now = todayIso();

  return {
    id: ingredient?.id ?? createId(),
    name: ingredient?.name ?? "",
    categoryId: ingredient?.categoryId ?? defaultCategoryId ?? "",
    preferredUnit: ingredient?.preferredUnit ?? "g",
    notes: ingredient?.notes ?? "",
    createdAt: ingredient?.createdAt ?? now,
  };
}

function buildIngredientFromDraft(
  draft: IngredientDraft,
  densityValue: string,
  densityUnit: DensityUnit,
  unitWeightValue: string,
  unitWeightUnit: UnitWeightUnit,
): Ingredient {
  const densityNumber = parseNumberInput(densityValue);
  const unitWeightNumber = parseNumberInput(unitWeightValue);
  const now = todayIso();

  return {
    id: draft.id,
    name: draft.name.trim(),
    categoryId: draft.categoryId || undefined,
    preferredUnit: draft.preferredUnit,
    density:
      densityNumber && densityNumber > 0
        ? {
            value: densityNumber,
            unit: densityUnit,
          }
        : undefined,
    unitWeight:
      unitWeightNumber && unitWeightNumber > 0
        ? {
            value: unitWeightNumber,
            unit: unitWeightUnit,
          }
        : undefined,
    notes: draft.notes.trim() || undefined,
    createdAt: draft.createdAt,
    updatedAt: now,
  };
}
