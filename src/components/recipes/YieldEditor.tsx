import { useI18n } from "../../app/i18n";
import { NumberInput } from "../common/NumberInput";
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
            <NumberInput
              min={0}
              value={value.amount}
              onValueChange={(amount) => onChange({ ...value, amount })}
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
            <NumberInput
              min={0}
              value={value.amount}
              onValueChange={(amount) => onChange({ ...value, amount })}
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
            <NumberInput
              min={0}
              value={value.amount}
              onValueChange={(amount) => onChange({ ...value, amount })}
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
            <NumberInput
              min={0}
              value={value.amount}
              onValueChange={(amount) => onChange({ ...value, amount })}
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
                <NumberInput
                  min={0}
                  value={value.circle?.diameter ?? 0}
                  onValueChange={(diameter) =>
                    onChange({
                      ...value,
                      circle: { diameter, unit: value.circle?.unit ?? "cm" },
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
                <NumberInput
                  min={0}
                  value={value.rectangle?.width ?? 0}
                  onValueChange={(width) =>
                    onChange({
                      ...value,
                      rectangle: {
                        width,
                        length: value.rectangle?.length ?? 0,
                        unit: value.rectangle?.unit ?? "cm",
                      },
                    })
                  }
                />
              </label>
              <label>
                {t("Length")}
                <NumberInput
                  min={0}
                  value={value.rectangle?.length ?? 0}
                  onValueChange={(length) =>
                    onChange({
                      ...value,
                      rectangle: {
                        width: value.rectangle?.width ?? 0,
                        length,
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
                <NumberInput
                  min={0}
                  value={value.cylinder?.diameter ?? 0}
                  onValueChange={(diameter) =>
                    onChange({
                      ...value,
                      cylinder: {
                        diameter,
                        height: value.cylinder?.height ?? 0,
                        unit: value.cylinder?.unit ?? "cm",
                      },
                    })
                  }
                />
              </label>
              <label>
                {t("Height")}
                <NumberInput
                  min={0}
                  value={value.cylinder?.height ?? 0}
                  onValueChange={(height) =>
                    onChange({
                      ...value,
                      cylinder: {
                        diameter: value.cylinder?.diameter ?? 0,
                        height,
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
                <NumberInput
                  min={0}
                  value={value.rectangularPrism?.width ?? 0}
                  onValueChange={(width) =>
                    onChange({
                      ...value,
                      rectangularPrism: {
                        width,
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
                <NumberInput
                  min={0}
                  value={value.rectangularPrism?.length ?? 0}
                  onValueChange={(length) =>
                    onChange({
                      ...value,
                      rectangularPrism: {
                        width: value.rectangularPrism?.width ?? 0,
                        length,
                        height: value.rectangularPrism?.height ?? 0,
                        unit: value.rectangularPrism?.unit ?? "cm",
                      },
                    })
                  }
                />
              </label>
              <label>
                {t("Height")}
                <NumberInput
                  min={0}
                  value={value.rectangularPrism?.height ?? 0}
                  onValueChange={(height) =>
                    onChange({
                      ...value,
                      rectangularPrism: {
                        width: value.rectangularPrism?.width ?? 0,
                        length: value.rectangularPrism?.length ?? 0,
                        height,
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
