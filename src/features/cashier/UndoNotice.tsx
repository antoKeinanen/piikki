import { Button, Text } from "@chakra-ui/react";

export type Undo = {
  message: string;
  action: string;
  run(): Promise<void>;
  /** The deleted person this undo restores, so restoring elsewhere can clear it. */
  restores?: string;
};

/** Offers to undo the latest person edit or deletion. */
export function UndoNotice({
  undo,
  busy,
  dismiss,
}: {
  undo: Undo;
  busy: boolean;
  dismiss(): void;
}) {
  return (
    <div className="undo-notice" role="status">
      <Text>{undo.message}</Text>
      <Button
        variant="outline"
        size="sm"
        className="secondary"
        disabled={busy}
        onClick={() => void undo.run().then(dismiss, () => {})}
      >
        {undo.action}
      </Button>
      <Button variant="ghost" size="sm" className="quiet undo-dismiss" aria-label="Sulje ilmoitus" disabled={busy} onClick={dismiss}>
        ×
      </Button>
    </div>
  );
}
