import { useState } from "react";
import { Button, Field, Textarea } from "@chakra-ui/react";
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
  const [note, setNote] = useState(customer.note);
  return (
    <form
      className="note-form"
      onSubmit={(event) => {
        event.preventDefault();
        void save(customer.id, note).catch(() => {});
      }}
    >
      <Field.Root>
        <Field.Label>Muistiinpano</Field.Label>
        <Textarea
          value={note}
          disabled={busy}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field.Root>
      <Button type="submit" disabled={busy || note === customer.note}>
        Tallenna muistiinpano
      </Button>
    </form>
  );
}
