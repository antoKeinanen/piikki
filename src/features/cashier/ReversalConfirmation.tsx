import { Button, Text } from "@chakra-ui/react";
import { formatAmount, type Entry } from "../../ledger";
export function ReversalConfirmation({
  customerName,
  entry,
  busy,
  confirm,
}: {
  customerName: string;
  entry: Entry;
  busy: boolean;
  confirm(): Promise<void>;
}) {
  return (
    <div className="settings-form">
      <Text className="reversal-name">{customerName}</Text>
      <Text>Perutaanko {formatAmount(Math.abs(entry.cents))} € tapahtuma?</Text>
      <Button
        className="primary"
        disabled={busy}
        onClick={() => void confirm().catch(() => {})}
      >
        Peru tapahtuma
      </Button>
    </div>
  );
}
