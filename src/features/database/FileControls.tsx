import type { ReactNode } from "react";
import { Button, Text } from "@chakra-ui/react";
export function FileControls({
  busy,
  error,
  note,
  onOpen,
  onBackup,
}: {
  busy: boolean;
  error: string;
  note?: ReactNode;
  onOpen(): void;
  onBackup(): void;
}) {
  return (
    <>
      <section className="file-section" aria-labelledby="file-save-title">
        <h3 id="file-save-title" className="file-section-title">Tallennus</h3>
        <div className="file-status">
          <Text className="file-status-title">Muutokset tallentuvat automaattisesti.</Text>
          {note}
        </div>
        <Button variant="outline" className="secondary" disabled={busy} onClick={onBackup}>
          Lataa varmuuskopio
        </Button>
      </section>
      <section className="file-section" aria-labelledby="file-switch-title">
        <h3 id="file-switch-title" className="file-section-title">Toinen tietokanta</h3>
        <Text className="file-section-help">
          Vuoro jatkuu valitusta tiedostosta. Tämän tiedoston muutokset on jo tallennettu.
        </Text>
        <Button variant="outline" className="secondary" disabled={busy} onClick={onOpen}>
          Vaihda tietokantaa
        </Button>
      </section>
      {error && (
        <Text role="alert" className="error">
          {error}
        </Text>
      )}
    </>
  );
}
