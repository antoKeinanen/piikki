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
          Valitse osakunnan tietokantatiedosto. Sen nimi päättyy yleensä .sqlite.
        </p>
        <Button size="xl" className="primary" disabled={busy} onClick={onOpen}>
          Avaa osakunnan tietokanta
        </Button>
        <span className="drop-label">Voit myös pudottaa tiedoston tähän.</span>
        <div className="welcome-new">
          <span className="welcome-new-label">Ei vielä tietokantaa?</span>
          <Button variant="outline" className="secondary" disabled={busy} onClick={onCreate}>
            Luo tietokanta
          </Button>
        </div>
      </div>
      {error && (
        <Text role="alert" className="error">
          {error}
        </Text>
      )}
    </main>
  );
}
