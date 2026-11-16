import { useState } from "react";
import { OPERATOR_MAX } from "../../ledger";
import { Field } from "../../ui/Field";
import { DialogActions } from "../../ui/DialogActions";

/** Asks who is on shift, so every balance change can be traced to them. */
export function OperatorPrompt({
  current,
  recent,
  choose,
  cancel,
}: {
  current: string;
  recent: string[];
  choose(name: string): void;
  /** Missing when nobody is on shift yet, because someone has to be. */
  cancel?: () => void;
}) {
  const [name, setName] = useState("");
  const others = recent.filter((value) => value !== current);
  return (
    <div className="dialog-form">
      <p className="dialog-text">
        Nimesi tallentuu jokaiseen kirjaukseen, jonka teet.
      </p>
      {!!others.length && (
        <div className="choice-list" role="group" aria-label="Aiemmin vuorossa">
          {others.map((value) => (
            <button
              type="button"
              key={value}
              className="btn btn-secondary btn-lg"
              onClick={() => choose(value)}
            >
              {value}
            </button>
          ))}
        </div>
      )}
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) choose(name.trim());
        }}
      >
        <Field label={others.length ? "Tai kirjoita nimesi" : "Nimesi"}>
          {(control) => (
            <input
              {...control}
              className="input"
              autoFocus={!others.length}
              autoComplete="off"
              required
              maxLength={OPERATOR_MAX}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <DialogActions onCancel={cancel}>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={!name.trim()}
          >
            Aloita vuoro
          </button>
        </DialogActions>
      </form>
    </div>
  );
}
