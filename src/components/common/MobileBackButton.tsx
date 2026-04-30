import { useI18n } from "../../app/i18n";

interface MobileBackButtonProps {
  onClick: () => void;
}

export function MobileBackButton({ onClick }: MobileBackButtonProps) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      className="mobile-back-button"
      aria-label={t("Back")}
      title={t("Back")}
      onClick={onClick}
    >
      <span aria-hidden="true">&larr;</span>
    </button>
  );
}
