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
      <div className="welcome-card">
        <h1 className="welcome-title">Aloita vuoro</h1>
        <p className="welcome-text">
          Avaa osakunnan tietokanta. Jos tietokantaa ei vielä ole, luo uusi.
        </p>
        <Button size="xl" className="primary" disabled={busy} onClick={onOpen}>
          Avaa tietokanta
        </Button>
        <Button variant="outline" className="secondary" disabled={busy} onClick={onCreate}>
          Luo tietokanta
        </Button>
        <span className="drop-label">Voit myös pudottaa tietokantatiedoston tähän.</span>
      </div>
      {error && (
        <Text role="alert" className="error">
          {error}
        </Text>
      )}
    </main>
  );
}
