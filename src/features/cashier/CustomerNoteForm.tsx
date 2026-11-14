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
        {customer.note && <Text className="note-text">{customer.note}</Text>}
        <Button
          variant="ghost"
          size="sm"
          className="compact-action"
          aria-label={customer.note ? "Muokkaa muistiinpanoa" : undefined}
          disabled={busy}
          onClick={() => {
            setNote(customer.note);
            setEditing(true);
          }}
        >
          {customer.note ? "Muokkaa" : "Lisää muistiinpano"}
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
        <Button type="button" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
          Peruuta
        </Button>
        <Button type="submit" className="note-save" disabled={busy || note === customer.note}>
          Tallenna muistiinpano
        </Button>
      </div>
    </form>
  );
}
