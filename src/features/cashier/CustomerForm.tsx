import { useState, type ReactNode } from "react";
import { Button, Field, Input } from "@chakra-ui/react";
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
/** Adds a person, or edits one when initial values are given. */
export function CustomerForm({
  busy,
  save,
  initial = { name: "", osakunta: "" },
  submitLabel = "Lisää henkilö",
}: {
  busy: boolean;
  save(name: string, osakunta: string): Promise<void>;
  initial?: { name: string; osakunta: string };
  submitLabel?: string;
}) {
  const [name, setName] = useState(initial.name);
  const [osakunta, setOsakunta] = useState(initial.osakunta);
  const unchanged = name.trim() === initial.name && osakunta === initial.osakunta;
  return (
    <form
      className="settings-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save(name.trim(), osakunta).catch(() => {});
      }}
    >
      <FormField label="Nimi">
        <Input
          autoFocus
          required
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />
      </FormField>
      <FormField label="Osakunta (valinnainen)">
        <Input
          maxLength={5}
          value={osakunta}
          disabled={busy}
          onChange={(e) => setOsakunta(e.target.value)}
        />
      </FormField>
      <Button
        className="primary"
        type="submit"
        disabled={!name.trim() || osakunta.length > 5 || unchanged || busy}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
