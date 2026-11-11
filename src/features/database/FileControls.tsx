import { Button, Text } from "@chakra-ui/react";
export function FileControls({
  busy,
  error,
  onOpen,
  onBackup,
}: {
  busy: boolean;
  error: string;
  onOpen(): void;
  onBackup(): void;
}) {
  return (
    <>
      <Text className="file-saving-help">
        Muutokset tallentuvat automaattisesti.
      </Text>
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
