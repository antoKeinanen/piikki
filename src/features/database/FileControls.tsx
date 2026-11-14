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
      <div className="file-status">
        <Text className="file-status-title">Muutokset tallentuvat automaattisesti.</Text>
        {note}
      </div>
      <Button variant="outline" disabled={busy} onClick={onOpen}>
        Avaa tietokanta
      </Button>
      <Button variant="outline" disabled={busy} onClick={onBackup}>
        Lataa varmuuskopio
      </Button>
      {error && (
        <Text role="alert" className="error">
          {error}
        </Text>
      )}
    </>
  );
}
