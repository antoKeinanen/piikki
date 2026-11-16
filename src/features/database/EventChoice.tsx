import { useState } from "react";
import { Field } from "../../ui/Field";
import { DialogActions } from "../../ui/DialogActions";

export function EventChoice({
  previousName,
  busy,
  onContinue,
  onCreate,
  cancel,
}: {
  previousName?: string;
  busy: boolean;
  onContinue(): void;
  onCreate(name: string): Promise<void>;
  cancel(): void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="dialog-form">
      {previousName && (
        <>
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            disabled={busy}
            onClick={onContinue}
          >
            Jatka tapahtumaa {previousName}
          </button>
          <p className="divider-text">tai aloita uusi tapahtuma</p>
        </>
      )}
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && name.trim()) void onCreate(name);
        }}
      >
        <Field
          label="Uuden tapahtuman nimi"
          hint={previousName ? "Saldot siirtyvät uuteen tapahtumaan." : undefined}
        >
          {(id) => (
            <input
              id={id}
              className="input"
              autoFocus={!previousName}
              autoComplete="off"
              required
              maxLength={100}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <DialogActions onCancel={cancel} busy={busy}>
          <button
            className={previousName ? "btn btn-secondary" : "btn btn-primary"}
            type="submit"
            disabled={busy || !name.trim()}
          >
            Aloita uusi tapahtuma
          </button>
        </DialogActions>
      </form>
    </div>
  );
}
