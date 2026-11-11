import { Button, Text } from "@chakra-ui/react";
export function Welcome({
  busy,
  error,
  onOpen,
  onCreate,
}: {
  busy: boolean;
  error: string;
  onOpen(): void;
  onCreate(): void;
}) {
  return (
    <main className="welcome">
      <Button size="xl" className="primary" disabled={busy} onClick={onOpen}>
        Avaa tietokanta
      </Button>
      <span className="drop-label">tai pudota SQLite-tiedosto tähän</span>
      <Button variant="ghost" disabled={busy} onClick={onCreate}>
        Luo tietokanta
      </Button>
      {error && (
        <Text role="alert" className="error">
          {error}
        </Text>
      )}
    </main>
  );
}
