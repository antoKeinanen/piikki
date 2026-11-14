import { useState } from "react";
import { Button, Field, Input, Stack, Text } from "@chakra-ui/react";
import { OPERATOR_MAX } from "../../ledger";

/** Asks who is at the till, so every balance change can be traced to them. */
export function OperatorPrompt({
  current,
  recent,
  choose,
}: {
  current: string;
  recent: string[];
  choose(name: string): void;
}) {
  const [name, setName] = useState(current);
  const others = recent.filter((value) => value !== current);
  return (
    <Stack gap="4">
      <Text className="operator-help">
        Nimesi tallentuu jokaiseen tekemääsi saldomuutokseen.
      </Text>
      {!!others.length && (
        <>
          <div className="operator-recent-section">
            <Text id="operator-recent-label" className="operator-recent-label">
              Valitse aiempi nimi
            </Text>
            <div className="operator-recent" role="group" aria-labelledby="operator-recent-label">
              {others.map((value) => (
                <Button key={value} variant="outline" onClick={() => choose(value)}>
                  {value}
                </Button>
              ))}
            </div>
          </div>
          <div className="event-or">tai kirjoita nimi</div>
        </>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) choose(name.trim());
        }}
      >
        <Stack gap="4">
          <Field.Root required>
            <Field.Label htmlFor="operator-name">Isännän tai apuisännän nimi</Field.Label>
            <Input
              id="operator-name"
              autoFocus
              autoComplete="off"
              required
              maxLength={OPERATOR_MAX}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field.Root>
          <Button className="primary operator-submit" type="submit" disabled={!name.trim()}>
            Aloita vuoro
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
