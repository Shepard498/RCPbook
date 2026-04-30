import { useI18n } from "../../app/i18n";
import { UnitSelect } from "../common/UnitSelect";
import type { YieldDefinition, YieldType } from "../../domain/recipes/yieldTypes";
import { createDefaultYield } from "../../domain/recipes/yieldFormatting";

interface YieldEditorProps {
  value: YieldDefinition;
  onChange: (value: YieldDefinition) => void;
}

const yieldTypeLabels: Record<YieldType, string> = {
  count: "Count",
  mass: "Mass",
  volume: "Volume",
  servings: "Servings",
  moldArea: "Mold area",
  moldVolume: "Mold volume",
};

export function YieldEditor({ value, onChange }: YieldEditorProps) {
  const { t } = useI18n();

  return (
    <section className="editor-section">
      <div className="section-header">
        <h3>{t("Yield")}</h3>
      </div>

      <div className="form-grid">
        <label>
          {t("Type")}
          <select
            value={value.type}
            onChange={(event) => onChange(createDefaultYield(event.target.value as YieldType))}
          >
            {(Object.keys(yieldTypeLabels) as YieldType[]).map((type) => (
              <option key={type} value={type}>
                {t(yieldTypeLabels[type])}
              </option>
            ))}
          </select>
        </label>

        {renderYieldFields(value, onChange, t)}
      </div>
    </section>
  );
}

function renderYieldFields(
  value: YieldDefinition,
  onChange: (value: YieldDefinition) => void,
  t: (key: string) => string,
) {
  switch (value.type) {
    case "count":
      return (
        <>
          <label>
            {t("Amount")}
            <input
              type="number"
              min="0"
              step="any"
              value={value.amount}
              onChange={(event) => onChange({ ...value, amount: Number(event.target.value) })}
            />
          </label>
          <label className="full-width">
            {t("Label")}
            <input value={value.label} onChange={(event) => onChange({ ...value, label: event.target.value })} />
          </label>
        </>
      );
    case "mass":
      return (
        <>
          <label>
            {t("Amount")}
            <input
              type="number"
              min="0"
              step="any"
              value={value.amount}
              onChange={(event) => onChange({ ...value, amount: Number(event.target.value) })}
            />
          </label>
          <label>
            {t("Unit")}
            <UnitSelect value={value.unit} allowedDimensions={["mass"]} onChange={(unit) => onChange({ ...value, unit })} />
          </label>
        </>
      );
    case "volume":
      return (
        <>
          <label>
            {t("Amount")}
            <input
              type="number"
              min="0"
              step="any"
              value={value.amount}
              onChange={(event) => onChange({ ...value, amount: Number(event.target.value) })}
            />
          </label>
          <label>
            {t("Unit")}
            <UnitSelect
              value={value.unit}
              allowedDimensions={["volume"]}
              onChange={(unit) => onChange({ ...value, unit })}
            />
          </label>
        </>
      );
    case "servings":
      return (
        <>
          <label>
            {t("Amount")}
            <input
              type="number"
              min="0"
              step="any"
              value={value.amount}
              onChange={(event) => onChange({ ...value, amount: Number(event.target.value) })}
            />
          </label>
          <label className="full-width">
            {t("Label")}
            <input value={value.label} onChange={(event) => onChange({ ...value, label: event.target.value })} />
          </label>
        </>
      );
    case "moldArea":
      return (
        <>
          <label>
            {t("Shape")}
            <select
              value={value.shape}
              onChange={(event) =>
                onChange(
                  event.target.value === "circle"
                    ? { type: "moldArea", shape: "circle", circle: { diameter: 20, unit: "cm" } }
                    : {
                        type: "moldArea",
                        shape: "rectangle",
                        rectangle: { width: 20, length: 30, unit: "cm" },
                      },
                )
              }
            >
              <option value="rectangle">{t("Rectangle")}</option>
              <option value="circle">{t("Circle")}</option>
            </select>
          </label>
          {value.shape === "circle" ? (
            <>
              <label>
                {t("Diameter")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={value.circle?.diameter ?? 0}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      circle: { diameter: Number(event.target.value), unit: value.circle?.unit ?? "cm" },
                    })
                  }
                />
              </label>
              <label>
                {t("Unit")}
                <UnitSelect
                  value={value.circle?.unit ?? "cm"}
                  allowedDimensions={["length"]}
                  onChange={(unit) =>
                    onChange({
                      ...value,
                      circle: { diameter: value.circle?.diameter ?? 0, unit },
                    })
                  }
                />
              </label>
            </>
          ) : (
            <>
              <label>
                {t("Width")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={value.rectangle?.width ?? 0}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      rectangle: {
                        width: Number(event.target.value),
                        length: value.rectangle?.length ?? 0,
                        unit: value.rectangle?.unit ?? "cm",
                      },
                    })
                  }
                />
              </label>
              <label>
                {t("Length")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={value.rectangle?.length ?? 0}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      rectangle: {
                        width: value.rectangle?.width ?? 0,
                        length: Number(event.target.value),
                        unit: value.rectangle?.unit ?? "cm",
                      },
                    })
                  }
                />
              </label>
              <label>
                {t("Unit")}
                <UnitSelect
                  value={value.rectangle?.unit ?? "cm"}
                  allowedDimensions={["length"]}
                  onChange={(unit) =>
                    onChange({
                      ...value,
                      rectangle: {
                        width: value.rectangle?.width ?? 0,
                        length: value.rectangle?.length ?? 0,
                        unit,
                      },
                    })
                  }
                />
              </label>
            </>
          )}
        </>
      );
    case "moldVolume":
      return (
        <>
          <label>
            {t("Shape")}
            <select
              value={value.shape}
              onChange={(event) =>
                onChange(
                  event.target.value === "cylinder"
                    ? {
                        type: "moldVolume",
                        shape: "cylinder",
                        cylinder: { diameter: 20, height: 5, unit: "cm" },
                      }
                    : {
                        type: "moldVolume",
                        shape: "rectangularPrism",
                        rectangularPrism: { width: 20, length: 30, height: 5, unit: "cm" },
                      },
                )
              }
            >
              <option value="rectangularPrism">{t("Box")}</option>
              <option value="cylinder">{t("Cylinder")}</option>
            </select>
          </label>
          {value.shape === "cylinder" ? (
            <>
              <label>
                {t("Diameter")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={value.cylinder?.diameter ?? 0}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      cylinder: {
                        diameter: Number(event.target.value),
                        height: value.cylinder?.height ?? 0,
                        unit: value.cylinder?.unit ?? "cm",
                      },
                    })
                  }
                />
              </label>
              <label>
                {t("Height")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={value.cylinder?.height ?? 0}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      cylinder: {
                        diameter: value.cylinder?.diameter ?? 0,
                        height: Number(event.target.value),
                        unit: value.cylinder?.unit ?? "cm",
                      },
                    })
                  }
                />
              </label>
              <label>
                {t("Unit")}
                <UnitSelect
                  value={value.cylinder?.unit ?? "cm"}
                  allowedDimensions={["length"]}
                  onChange={(unit) =>
                    onChange({
                      ...value,
                      cylinder: {
                        diameter: value.cylinder?.diameter ?? 0,
                        height: value.cylinder?.height ?? 0,
                        unit,
                      },
                    })
                  }
                />
              </label>
            </>
          ) : (
            <>
              <label>
                {t("Width")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={value.rectangularPrism?.width ?? 0}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      rectangularPrism: {
                        width: Number(event.target.value),
                        length: value.rectangularPrism?.length ?? 0,
                        height: value.rectangularPrism?.height ?? 0,
                        unit: value.rectangularPrism?.unit ?? "cm",
                      },
                    })
                  }
                />
              </label>
              <label>
                {t("Length")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={value.rectangularPrism?.length ?? 0}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      rectangularPrism: {
                        width: value.rectangularPrism?.width ?? 0,
                        length: Number(event.target.value),
                        height: value.rectangularPrism?.height ?? 0,
                        unit: value.rectangularPrism?.unit ?? "cm",
                      },
                    })
                  }
                />
              </label>
              <label>
                {t("Height")}
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={value.rectangularPrism?.height ?? 0}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      rectangularPrism: {
                        width: value.rectangularPrism?.width ?? 0,
                        length: value.rectangularPrism?.length ?? 0,
                        height: Number(event.target.value),
                        unit: value.rectangularPrism?.unit ?? "cm",
                      },
                    })
                  }
                />
              </label>
              <label>
                {t("Unit")}
                <UnitSelect
                  value={value.rectangularPrism?.unit ?? "cm"}
                  allowedDimensions={["length"]}
                  onChange={(unit) =>
                    onChange({
                      ...value,
                      rectangularPrism: {
                        width: value.rectangularPrism?.width ?? 0,
                        length: value.rectangularPrism?.length ?? 0,
                        height: value.rectangularPrism?.height ?? 0,
                        unit,
                      },
                    })
                  }
                />
              </label>
            </>
          )}
        </>
      );
  }
}
