import { translateWarning, useI18n } from "../../app/i18n";
import { ChevronDown, TriangleAlert } from "lucide-react";

interface WarningListProps {
  warnings: string[];
  collapsible?: boolean;
}

export function WarningList({ warnings, collapsible = false }: WarningListProps) {
  const { t } = useI18n();

  if (warnings.length === 0) {
    return <span className="badge neutral">{t("OK")}</span>;
  }

  const badges = (
    <div className="badge-list">
      {warnings.map((warning, index) => (
        <span
          className={`badge ${warning === "Missing price" || warning === "Invalid purchase option" ? "danger" : "warning"}`}
          key={`${index}-${warning}`}
        >
          {translateWarning(t, warning)}
        </span>
      ))}
    </div>
  );

  if (!collapsible) return badges;

  return (
    <details className="warning-disclosure">
      <summary>
        <TriangleAlert size={18} aria-hidden="true" />
        <span>{t("Warnings")}</span>
        <span className="warning-count">{warnings.length}</span>
        <ChevronDown size={18} className="warning-chevron" aria-hidden="true" />
      </summary>
      <div className="warning-disclosure-content">{badges}</div>
    </details>
  );
}
