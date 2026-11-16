import type { ReactNode } from "react";

/** The latest change, with a way to undo it. Stays until replaced or closed. */
export function Toast({
  children,
  action,
  busy,
  onAction,
  dismiss,
}: {
  children: ReactNode;
  action: string;
  busy: boolean;
  onAction(): void;
  dismiss(): void;
}) {
  return (
    <div className="toast" role="status">
      <p className="toast-text">{children}</p>
      <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={onAction}>
        {action}
      </button>
      <button type="button" className="btn btn-ghost btn-sm toast-close" aria-label="Sulje ilmoitus" onClick={dismiss}>
        ×
      </button>
    </div>
  );
}
