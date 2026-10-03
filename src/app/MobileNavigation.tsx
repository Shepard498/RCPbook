import { X } from "lucide-react";
import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { useI18n } from "./i18n";

export function MobileNavigation({ open, onOpen, onClose, navigation, children }: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  navigation: ReactNode;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const gesture = useRef<{ x: number; y: number; id: number } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    gesture.current = null;
    if (open && !dialog?.open) dialog?.showModal();
    if (open || !dialog?.open) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dialog.close();
      return;
    }

    // Keep the dialog in the top layer until it has slid completely offscreen.
    const animation = dialog.animate(
      [{ transform: getComputedStyle(dialog).transform }, { transform: "translateX(-100%)" }],
      { duration: 180, easing: "ease-in", fill: "forwards" },
    );
    void animation.finished.then(() => dialog.close()).catch(() => {});
    return () => animation.cancel();
  }, [open]);

  function startGesture(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "touch" || !event.isPrimary) return;
    if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea")) return;
    gesture.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveGesture(event: PointerEvent<HTMLElement>) {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = Math.abs(event.clientY - start.y);
    if (dy > 30 && dy > Math.abs(dx)) gesture.current = null;
    if ((open ? dx < -60 : dx > 60) && Math.abs(dx) > dy * 2) {
      gesture.current = null;
      if (open) onClose();
      else onOpen();
    }
  }

  const gestureHandlers = {
    onPointerDown: startGesture,
    onPointerMove: moveGesture,
    onPointerUp: () => { gesture.current = null; },
    onPointerCancel: () => { gesture.current = null; },
  };

  return (
    <>
      {!open ? <div className="drawer-swipe-edge print-hidden" aria-hidden="true" {...gestureHandlers} /> : null}
      <dialog
        ref={dialogRef}
        id="mobile-navigation"
        className="mobile-drawer print-hidden"
        data-closing={!open || undefined}
        aria-label={t("Menu")}
        onCancel={(event) => { event.preventDefault(); onClose(); }}
        onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      >
        <div className="mobile-drawer-content" inert={!open} {...gestureHandlers}>
          <div className="mobile-drawer-header">
            <h2>{t("Recipe Manager")}</h2>
            <button type="button" className="icon-button" aria-label={t("Close menu")} title={t("Close menu")} onClick={onClose}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="mobile-drawer-body">
            <nav className="drawer-navigation" aria-label={t("Primary navigation")}>{navigation}</nav>
            <h3>{t("Settings")}</h3>
            {children}
          </div>
        </div>
      </dialog>
    </>
  );
}
