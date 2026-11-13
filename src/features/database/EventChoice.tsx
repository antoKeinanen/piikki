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
      {previousName && <>
        <Text>Edellinen tapahtuma: {previousName}</Text>
        <Button disabled={busy} onClick={onContinue} whiteSpace="normal" height="auto" minH="10" py="2" overflowWrap="anywhere">
          Jatka tapahtumaa {previousName}
        </Button>
        <Text>Saldot jatkuvat edellisestä tapahtumasta. Aiemmat tapahtumat säilyvät tietokannassa.</Text>
      </>}
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!busy && name.trim()) void onCreate(name);
      }}>
        <Stack gap="4">
          <Field.Root required>
            <Field.Label htmlFor="event-name">Tapahtuman nimi</Field.Label>
            <Input id="event-name" required maxLength={100} value={name}
              disabled={busy} onChange={(event) => setName(event.target.value)} />
          </Field.Root>
          <Button className="primary" type="submit" disabled={busy || !name.trim()}>
            Luo uusi tapahtuma
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
