import { Button, Dialog, Text } from "@chakra-ui/react";
import { formatAmount, type Entry } from "../../ledger";

const signed = (cents: number) => (cents > 0 ? "+" : "−") + formatAmount(Math.abs(cents));

export function ReversalConfirmation({
  customerName,
  entry,
  title,
  balance,
  busy,
  confirm,
}: {
  customerName: string;
  entry: Entry;
  /** The history label of the entry, such as a product name. */
  title: string;
  balance: number;
  busy: boolean;
  confirm(): Promise<void>;
}) {
  const time = new Date(entry.created_at).toLocaleString("fi-FI", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const action = entry.cents > 0 ? "Kumoa saldon lisäys" : "Kumoa veloitus";
  return (
    <div className="settings-form">
      <div className="reversal-head">
        <Dialog.Title>{action}?</Dialog.Title>
        <Text className="reversal-name">{customerName}</Text>
      </div>
      <div className="reversal-entry">
        <div>
          <Text className="reversal-title">{title}</Text>
          <Text className="reversal-time">{time}</Text>
        </div>
        <Text className={`reversal-amount ${entry.cents > 0 ? "positive" : "negative"}`}>
          {signed(entry.cents)}
        </Text>
      </div>
      <Text className="reversal-balance">
        Saldo {formatAmount(balance)} → <strong>{formatAmount(balance - entry.cents)}</strong>
      </Text>
      <Button
        className="primary"
        disabled={busy}
        onClick={() => void confirm().catch(() => {})}
      >
        {action}
      </Button>
    </div>
  );
}
