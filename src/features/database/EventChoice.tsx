import { useState } from "react";
import { Button, Field, Input, Stack, Text } from "@chakra-ui/react";

export function EventChoice({ previousName, busy, onContinue, onCreate }: {
  previousName?: string;
  busy: boolean;
  onContinue(): void;
  onCreate(name: string): Promise<void>;
}) {
  const [name, setName] = useState("");
  return (
    <Stack gap="4">
      {previousName && <section className="event-option">
        <Text className="event-option-title">Edellinen tapahtuma: {previousName}</Text>
        <Button className="primary" disabled={busy} onClick={onContinue} whiteSpace="normal" height="auto" minH="11" py="2" overflowWrap="anywhere">
          Jatka tapahtumaa {previousName}
        </Button>
      </section>}
      {previousName && <div className="event-or" aria-hidden="true">tai</div>}
      <form className="event-option" onSubmit={(event) => {
        event.preventDefault();
        if (!busy && name.trim()) void onCreate(name);
      }}>
        <Stack gap="4">
          <Field.Root required>
            <Field.Label htmlFor="event-name">Tapahtuman nimi</Field.Label>
            <Input id="event-name" required maxLength={100} value={name}
              disabled={busy} onChange={(event) => setName(event.target.value)} />
          </Field.Root>
          {previousName && (
            <Text className="event-option-help">
              Saldot jatkuvat edellisestä tapahtumasta. Aiemmat tapahtumat säilyvät tietokannassa.
            </Text>
          )}
          <Button variant="outline" className={previousName ? "secondary" : "primary"} type="submit" disabled={busy || !name.trim()}>
            Luo uusi tapahtuma
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
