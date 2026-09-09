import { useEffect } from "react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as a destructive action. */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A small yes/no modal — the branded replacement for `window.confirm`.
 * Escape and backdrop click both cancel.
 */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 motion-safe:animate-[fade-in_120ms_ease-out]"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl motion-safe:animate-[pop-in_150ms_var(--ease-emphasized)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-title"
          className="text-base font-semibold text-slate-900"
        >
          {title}
        </h2>
        <p id="confirm-body" className="mt-2 text-sm text-slate-500">
          {message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            value={cancelLabel}
            variant="secondary"
            fullWidth={false}
            disabled={loading}
            onClick={onCancel}
          />
          <Button
            value={confirmLabel}
            variant={destructive ? "danger" : "primary"}
            fullWidth={false}
            loading={loading}
            onClick={onConfirm}
          />
        </div>
      </div>
    </div>
  );
}
