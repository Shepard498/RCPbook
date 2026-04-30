import { translateWarning, useI18n } from "../../app/i18n";

interface WarningListProps {
  warnings: string[];
}

export function WarningList({ warnings }: WarningListProps) {
  const { t } = useI18n();

  if (warnings.length === 0) {
    return <span className="badge neutral">{t("OK")}</span>;
  }

  return (
    <div className="badge-list">
      {warnings.map((warning) => (
        <span
          className={`badge ${warning === "Missing price" || warning === "Invalid purchase option" ? "danger" : "warning"}`}
          key={warning}
        >
          {translateWarning(t, warning)}
        </span>
      ))}
    </div>
  );
}
