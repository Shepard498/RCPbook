import { useI18n } from "../../app/i18n";
import { ArrowLeft } from "lucide-react";

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
      <ArrowLeft size={18} aria-hidden="true" />
    </button>
  );
}
