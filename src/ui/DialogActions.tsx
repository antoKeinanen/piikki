import type { ReactNode } from "react";

/** The bottom row of every dialog: cancel on the left, the main action on the right. */
export function DialogActions({
  onCancel,
  cancelLabel = "Peruuta",
  busy,
  children,
}: {
  onCancel?: () => void;
  cancelLabel?: string;
  busy?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="dialog-actions">
      {onCancel && (
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </button>
      )}
      {children}
    </div>
  );
}
