import { useState, type ReactNode } from "react";
import { Button, Field, Input, NativeSelect, Text } from "@chakra-ui/react";
import { OSAKUNTA_MAX, formatAmount, parseSignedAmount, type Customer } from "../../ledger";
function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      {children}
    </Field.Root>
  );
}
const OTHER = "\u0000other";
/** Hints start after this many typed characters. */
const HINT_FROM = 2;
export type CustomerValues = { name: string; osakunta: string; openingCents: number };
/** Existing person, possibly deleted, shown as a duplicate hint. */
export type KnownPerson = Pick<Customer, "id" | "name" | "osakunta" | "balance"> & { removed?: boolean };

/** Adds a person, or edits one when initial values are given. */
export function CustomerForm({
  busy,
  save,
  initial = { name: "", osakunta: "" },
  submitLabel = "Lisää henkilö",
  osakunnat,
  people = [],
  selfId,
  onPick,
  withOpening = false,
}: {
  busy: boolean;
  save(values: CustomerValues): Promise<void>;
  initial?: { name: string; osakunta: string };
  submitLabel?: string;
  /** Choices for the osakunta dropdown. */
  osakunnat: string[];
  /** Everyone in the database, used to warn about duplicate names. */
  people?: KnownPerson[];
  /** The person being edited, left out of duplicate hints. */
  selfId?: string;
  /** Selects an existing person instead of adding a duplicate. */
  onPick?(id: string): void;
  withOpening?: boolean;
}) {
  const choices = [...new Set([...osakunnat, initial.osakunta].filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "fi"),
  );
  const [name, setName] = useState(initial.name);
  const [choice, setChoice] = useState(initial.osakunta);
  const [custom, setCustom] = useState("");
  const [opening, setOpening] = useState("");
  const osakunta = choice === OTHER ? custom.trim() : choice;
  let openingCents = 0;
  let openingError = "";
  if (opening.trim()) {
    try {
      openingCents = parseSignedAmount(opening);
    } catch {
      openingError = "Anna alkusaldo muodossa 12,50 tai -12,50.";
    }
  }
  const query = name.trim().toLocaleLowerCase("fi");
  const matches =
    query.length >= HINT_FROM
      ? people.filter(
          (person) =>
            person.id !== selfId && person.name.toLocaleLowerCase("fi").includes(query),
        )
      : [];
  const exact = matches.some((person) => person.name.toLocaleLowerCase("fi") === query);
  const unchanged = name.trim() === initial.name && osakunta === initial.osakunta;
  const addingDuplicate = matches.length > 0 && !selfId;
  // Picking the existing person stays the solid action; adding a duplicate is the fallback.
  const pickable = addingDuplicate && !!onPick && matches.some((person) => !person.removed);
  return (
    <form
      className="settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (openingError) return;
        void save({ name: name.trim(), osakunta, openingCents }).catch(() => {});
      }}
    >
      <FormField label="Nimi">
        <Input
          autoFocus
          required
          autoComplete="off"
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />
      </FormField>
      {!!matches.length && (
        <div className="name-hints" role="status" aria-label="Samankaltaiset nimet">
          <Text className="name-hints-heading">Tarkista ennen lisäämistä</Text>
          <Text className={exact ? "name-hint-warning" : "name-hint-title"}>
            {exact ? "Tämä nimi on jo kannassa." : "Kannassa on jo samankaltaisia nimiä:"}
          </Text>
          {matches.slice(0, 5).map((person) =>
            person.removed || !onPick ? (
              <Text key={person.id} className="name-hint">
                {person.name}
                {person.osakunta && ` • ${person.osakunta}`}
                {person.removed && " (poistettu, palautus asetuksista)"}
              </Text>
            ) : (
              <button
                type="button"
                key={person.id}
                className="name-hint"
                disabled={busy}
                onClick={() => onPick(person.id)}
              >
                <span className="name-hint-who">
                  {person.name}
                  <small>
                    {person.osakunta && `${person.osakunta} · `}
                    <span className="name-hint-balance">Saldo {formatAmount(person.balance)}</span>
                  </small>
                </span>
                <span className="name-hint-action">Valitse henkilö</span>
              </button>
            ),
          )}
          {matches.length > 5 && <Text className="name-hint">+ {matches.length - 5} muuta</Text>}
        </div>
      )}
      <FormField label="Osakunta (valinnainen)">
        <NativeSelect.Root disabled={busy}>
          <NativeSelect.Field value={choice} onChange={(e) => setChoice(e.currentTarget.value)}>
            <option value="">Ei osakuntaa</option>
            {choices.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
            <option value={OTHER}>Muu…</option>
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </FormField>
      {choice === OTHER && (
        <FormField label="Uusi osakunta">
          <Input
            autoFocus
            maxLength={OSAKUNTA_MAX}
            value={custom}
            disabled={busy}
            onChange={(e) => setCustom(e.target.value)}
          />
        </FormField>
      )}
      {withOpening && (
        <FormField label="Alkusaldo (valinnainen)">
          <Input
            inputMode="decimal"
            placeholder="0,00 tai -5,00 velkaa"
            value={opening}
            disabled={busy}
            onChange={(e) => setOpening(e.target.value)}
          />
        </FormField>
      )}
      {openingError && (
        <Text role="alert" className="error">
          {openingError}
        </Text>
      )}
      <Button
        className={pickable ? "secondary" : "primary"}
        variant={pickable ? "outline" : "solid"}
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
        {addingDuplicate ? "Lisää uutena henkilönä" : submitLabel}
      </Button>
    </form>
  );
}
