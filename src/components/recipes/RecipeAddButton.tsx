import { FileText, Icon, Plus, type IconNode } from "lucide-react";
import { useI18n } from "../../app/i18n";

const measuringCup: IconNode = [
  ["path", { d: "M3 10h13l-1.5 10h-10Z", key: "cup" }],
  ["path", { d: "M16 10h5v3h-5.5", key: "handle" }],
  ["path", { d: "M5 8c2-1 2-5 4-5s2 4 4 5", key: "powder" }],
  ["path", { d: "M4 14h4m-3.5 3H8", key: "measures" }],
];

const stairs: IconNode = [
  ["path", { d: "M3 20h18V4h-6v5H9v5H3Z", key: "steps" }],
];

const labels = {
  ingredient: "Add ingredient",
  subrecipe: "Add sub-recipe",
  step: "Add step",
};

interface RecipeAddButtonProps {
  kind: keyof typeof labels;
  disabled?: boolean;
  onClick: () => void;
}

export function RecipeAddButton({ kind, disabled, onClick }: RecipeAddButtonProps) {
  const { t } = useI18n();
  const label = t(labels[kind]);

  return (
    <button
      type="button"
      className="recipe-add-button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <span className="recipe-add-icons" aria-hidden="true">
        <Plus className="recipe-add-plus" size={14} />
        {kind === "subrecipe" ? <FileText size={24} /> : <Icon iconNode={kind === "ingredient" ? measuringCup : stairs} size={24} />}
      </span>
      <span className="recipe-add-label">{label}</span>
    </button>
  );
}
