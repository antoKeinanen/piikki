import { DialogActions } from "../../ui/DialogActions";
import type { Entry } from "../../ledger";
import { entryTitle, signedAmount } from "./AccountPanel";

export function ReversalConfirmation({
  customerName,
  entry,
  busy,
  confirm,
  cancel,
}: {
  customerName: string;
  entry: Entry;
  busy: boolean;
  confirm(): Promise<void>;
  cancel(): void;
}) {
  return (
    <div className="dialog-form">
      <dl className="summary">
        <dt>Henkilö</dt>
        <dd>{customerName}</dd>
        <dt>Kirjaus</dt>
        <dd>{entryTitle(entry)}</dd>
        <dt>Summa</dt>
        <dd className={entry.cents > 0 ? "positive" : "negative"}>
          {signedAmount(entry.cents)}
        </dd>
      </dl>
      <p className="dialog-text">
        Saldoon kirjataan {signedAmount(-entry.cents)}. Alkuperäinen kirjaus jää
        näkyviin perutuksi.
      </p>
      <DialogActions onCancel={cancel} cancelLabel="Älä peru" busy={busy}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void confirm().catch(() => {})}
        >
          Peru kirjaus
        </button>
      </DialogActions>
    </div>
  );
}
