import { useState } from "react";
import { Button, Field, Text, Textarea } from "@chakra-ui/react";
import type { Customer } from "../../ledger";

export function CustomerNoteForm({
  customer,
  busy,
  save,
}: {
  customer: Customer;
  busy: boolean;
  save(customerId: string, note: string): Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(customer.note);
  if (!editing) {
    return (
      <div className={`note-line ${customer.note ? "" : "empty"}`}>
        {customer.note && (
          <>
            <svg className="note-icon" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M3 2.5h7l3 3v8H3z M5.5 7h5 M5.5 10h3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            <Text className="note-text">{customer.note}</Text>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          className="secondary"
          disabled={busy}
          onClick={() => {
            setNote(customer.note);
            setEditing(true);
          }}
        >
          {customer.note ? "Muokkaa muistiinpanoa" : "Lisää muistiinpano"}
        </Button>
      </div>
    );
  }
  return (
    <form
      className="note-form"
      onSubmit={(event) => {
        event.preventDefault();
        save(customer.id, note).then(() => setEditing(false), () => {});
      }}
    >
      <Field.Root>
        <Field.Label>Muistiinpano</Field.Label>
        <Textarea
          autoFocus
          value={note}
          disabled={busy}
          onChange={(event) => setNote(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(false);
          }}
        />
      </Field.Root>
      <div className="note-actions">
        <Button type="button" variant="ghost" className="quiet" disabled={busy} onClick={() => setEditing(false)}>
          Peruuta
        </Button>
        <Button type="submit" className="note-save secondary" disabled={busy || note === customer.note}>
          Tallenna muistiinpano
        </Button>
      </div>
    </form>
  );
}
