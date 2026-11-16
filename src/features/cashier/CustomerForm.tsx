import { useState, type ReactNode } from "react";
import { OSAKUNTA_MAX, formatAmount, parseSignedAmount, type Customer } from "../../ledger";
import { Field } from "../../ui/Field";
import { DialogActions } from "../../ui/DialogActions";

const OTHER = "\u0000other";
/** Hints start after this many typed characters. */
const HINT_FROM = 2;
export type CustomerValues = { name: string; osakunta: string; openingCents: number; note: string };
/** Existing person, possibly deleted, shown as a duplicate hint. */
export type KnownPerson = Pick<Customer, "id" | "name" | "osakunta" | "balance"> & { removed?: boolean };

/** Adds a person, or edits one when initial values are given. */
export function CustomerForm({
  busy,
  save,
  cancel,
  initial = { name: "", osakunta: "", note: "" },
  submitLabel = "Lisää henkilö",
  osakunnat,
  people = [],
  selfId,
  onPick,
  withOpening = false,
  withNote = false,
  children,
}: {
  busy: boolean;
  save(values: CustomerValues): Promise<void>;
  cancel(): void;
  initial?: { name: string; osakunta: string; note: string };
  submitLabel?: string;
  /** Choices for the osakunta menu. */
  osakunnat: string[];
  /** Everyone in the database, used to warn about duplicate names. */
  people?: KnownPerson[];
  /** The person being edited, left out of duplicate hints. */
  selfId?: string;
  /** Selects an existing person instead of adding a duplicate. */
  onPick?(id: string): void;
  withOpening?: boolean;
  withNote?: boolean;
  /** Shown between the fields and the buttons. */
  children?: ReactNode;
}) {
  const choices = [...new Set([...osakunnat, initial.osakunta].filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "fi"),
  );
  const [name, setName] = useState(initial.name);
  const [choice, setChoice] = useState(initial.osakunta);
  const [custom, setCustom] = useState("");
  const [opening, setOpening] = useState("");
  const [note, setNote] = useState(initial.note);
  const osakunta = choice === OTHER ? custom.trim() : choice;
  let openingCents = 0;
  let openingError = "";
  if (opening.trim()) {
    try {
      openingCents = parseSignedAmount(opening);
    } catch {
      openingError = "Anna alkusaldo numeroina, esim. 12,50 tai -12,50.";
    }
  }
  const query = name.trim().toLocaleLowerCase("fi");
  const matches =
    query.length >= HINT_FROM
      ? people.filter(
          (person) => person.id !== selfId && person.name.toLocaleLowerCase("fi").includes(query),
        )
      : [];
  const exact = matches.some((person) => person.name.toLocaleLowerCase("fi") === query);
  // Only an edit can be unchanged. A new person may start from a searched name.
  const unchanged =
    selfId !== undefined &&
    name.trim() === initial.name && osakunta === initial.osakunta && note === initial.note;
  return (
    <form
      className="dialog-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (openingError) return;
        void save({ name: name.trim(), osakunta, openingCents, note }).catch(() => {});
      }}
    >
      <Field label="Nimi">
        {(id) => (
          <input
            id={id}
            className="input"
            autoFocus
            required
            autoComplete="off"
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </Field>
      {!!matches.length && (
        <div className="name-hints" role="status" aria-label="Samankaltaiset nimet">
          <p className={exact ? "name-hint-warning" : "name-hint-title"}>
            {exact ? "Tämä nimi on jo listalla." : "Listalla on jo samankaltaisia nimiä:"}
          </p>
          {matches.slice(0, 5).map((person) =>
            person.removed || !onPick ? (
              <p key={person.id} className="name-hint">
                <span>
                  {person.name}
                  {person.osakunta && ` · ${person.osakunta}`}
                </span>
                {person.removed && <span className="name-hint-detail">Poistettu. Palauta asetuksista.</span>}
              </p>
            ) : (
              <button
                type="button"
                key={person.id}
                className="name-hint"
                disabled={busy}
                onClick={() => onPick(person.id)}
              >
                <span>
                  {person.name}
                  {person.osakunta && ` · ${person.osakunta}`}
                </span>
                <span className="name-hint-detail">{formatAmount(person.balance)} · Valitse</span>
              </button>
            ),
          )}
          {matches.length > 5 && <p className="name-hint-title">ja {matches.length - 5} muuta</p>}
        </div>
      )}
      <Field label="Osakunta (valinnainen)">
        {(id) => (
          <select
            id={id}
            className="input select"
            value={choice}
            disabled={busy}
            onChange={(e) => setChoice(e.currentTarget.value)}
          >
            <option value="">Ei osakuntaa</option>
            {choices.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
            <option value={OTHER}>Muu, kirjoita nimi…</option>
          </select>
        )}
      </Field>
      {choice === OTHER && (
        <Field label="Osakunnan nimi">
          {(id) => (
            <input
              id={id}
              className="input"
              autoFocus
              maxLength={OSAKUNTA_MAX}
              value={custom}
              disabled={busy}
              onChange={(e) => setCustom(e.target.value)}
            />
          )}
        </Field>
      )}
      {withOpening && (
        <Field label="Alkusaldo (valinnainen)" hint="Velka miinusmerkillä, esim. -5,00.">
          {(id) => (
            <input
              id={id}
              className="input"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={opening}
              disabled={busy}
              onChange={(e) => setOpening(e.target.value)}
            />
          )}
        </Field>
      )}
      {openingError && (
        <p role="alert" className="error">
          {openingError}
        </p>
      )}
      {withNote && (
        <Field label="Muistiinpano" hint="Näkyy nimen alla kassanäkymässä.">
          {(id) => (
            <textarea
              id={id}
              className="input textarea"
              rows={3}
              value={note}
              disabled={busy}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
      )}
      {children}
      <DialogActions onCancel={cancel} busy={busy}>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={
            !name.trim() ||
            osakunta.length > OSAKUNTA_MAX ||
            (choice === OTHER && !osakunta) ||
            !!openingError ||
            unchanged ||
            busy
          }
        >
          {submitLabel}
        </button>
      </DialogActions>
    </form>
  );
}
