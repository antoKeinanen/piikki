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
export function AddCustomerForm({
  busy,
  save,
}: {
  busy: boolean;
  save(name: string, osakunta: string): Promise<void>;
}) {
  const [name, setName] = useState("");
  const [osakunta, setOsakunta] = useState("");
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
        disabled={!name.trim() || osakunta.length > 5 || busy}
      >
        Lisää henkilö
      </Button>
    </form>
  );
}
