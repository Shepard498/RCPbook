import { useI18n } from "../../app/i18n";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="dialog-header">
          <h2 id="confirm-title">{title}</h2>
        </div>
        <div className="dialog-body">
          <p>{message}</p>
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={onCancel}>
            {cancelLabel ?? t("Cancel")}
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            {confirmLabel ?? t("Delete")}
          </button>
        </div>
      </section>
    </div>
  );
}
