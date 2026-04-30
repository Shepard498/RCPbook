import { useI18n } from "../../app/i18n";
import { getUnitsForDimensions } from "../../domain/units/unitRegistry";
import type { UnitDimension, UnitId } from "../../domain/units/unitTypes";
import type { UnitDefinition } from "../../domain/units/unitTypes";

interface UnitSelectProps {
  value: UnitId;
  onChange: (value: UnitId) => void;
  allowedDimensions?: UnitDimension[];
  id?: string;
}

const dimensionLabels: Record<UnitDimension, string> = {
  mass: "Mass",
  volume: "Volume",
  count: "Count",
  length: "Length",
};

export function UnitSelect({ value, onChange, allowedDimensions, id }: UnitSelectProps) {
  const { t } = useI18n();
  const units = getUnitsForDimensions(allowedDimensions);
  const groups = units.reduce<Record<UnitDimension, UnitDefinition[]>>(
    (result, unit) => {
      result[unit.dimension].push(unit);
      return result;
    },
    {
      mass: [],
      volume: [],
      count: [],
      length: [],
    },
  );

  return (
    <select id={id} value={value} onChange={(event) => onChange(event.target.value as UnitId)}>
      {(Object.keys(groups) as UnitDimension[]).map((dimension) => {
        const groupUnits = groups[dimension];

        if (groupUnits.length === 0) {
          return null;
        }

        return (
          <optgroup key={dimension} label={t(dimensionLabels[dimension])}>
            {groupUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.id}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
