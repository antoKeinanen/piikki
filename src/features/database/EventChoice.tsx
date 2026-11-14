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
    <Stack gap="5">
      {previousName && <section className="event-option" aria-labelledby="event-continue-label">
        <h3 id="event-continue-label" className="event-step">Jatka edellistä</h3>
        <Button className="primary event-action" disabled={busy} onClick={onContinue} whiteSpace="normal" height="auto" py="2" overflowWrap="anywhere">
          Jatka tapahtumaa {previousName}
        </Button>
      </section>}
      {previousName && <div className="event-or" aria-hidden="true">tai</div>}
      <form className="event-option" aria-labelledby={previousName ? "event-new-label" : undefined} onSubmit={(event) => {
        event.preventDefault();
        if (!busy && name.trim()) void onCreate(name);
      }}>
        {previousName && <>
          <h3 id="event-new-label" className="event-step">Aloita uusi</h3>
          <Text className="event-option-help">
            Saldot jatkuvat edellisestä tapahtumasta. Aiemmat tapahtumat säilyvät tietokannassa.
          </Text>
        </>}
        <Field.Root required>
          <Field.Label htmlFor="event-name">Tapahtuman nimi</Field.Label>
          <Input id="event-name" required maxLength={100} value={name}
            disabled={busy} onChange={(event) => setName(event.target.value)} />
          <Field.HelperText>Kirjoita nimi, niin voit aloittaa uuden tapahtuman.</Field.HelperText>
        </Field.Root>
        <Button variant="outline" className={`event-action ${previousName ? "secondary" : "primary"}`} type="submit" disabled={busy || !name.trim()}>
          Luo uusi tapahtuma
        </Button>
      </form>
    </Stack>
  );
}
