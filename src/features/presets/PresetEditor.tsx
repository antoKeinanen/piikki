import { useState } from "react";
import { Button, Field, Input } from "@chakra-ui/react";
import { formatAmount, parseAmount, type Preset } from "../../ledger";

export function PresetEditor({
  presets,
  busy,
  save,
  remove,
  setError,
}: {
  presets: Preset[];
  busy: boolean;
  save(preset: Preset): Promise<void>;
  remove(id: string): Promise<void>;
  setError(message: string): void;
}) {
  const [amount, setAmount] = useState("");
  const [editing, setEditing] = useState<string>();
  const [removed, setRemoved] = useState<Preset>();
  async function apply(operation: () => Promise<void>, done?: () => void) {
    try {
      setError("");
      await operation();
      done?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <div className="settings-form">
      <div className="preset-list">
        {presets.map((p) => (
          <div className="preset-row" key={p.id}>
            <span>{formatAmount(p.cents)}</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setEditing(p.id);
                setAmount((p.cents / 100).toFixed(2));
              }}
            >
              Muokkaa
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                void apply(
                  () => remove(p.id),
                  () => setRemoved(p),
                )
              }
            >
              Poista
            </Button>
          </div>
        ))}
      </div>
      {removed && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void apply(
              () => save(removed),
              () => setRemoved(undefined),
            )
          }
        >
          Palauta {formatAmount(removed.cents)}
        </Button>
      )}
      <form
        className="preset-editor"
        onSubmit={(e) => {
          e.preventDefault();
          void apply(
            async () => {
              const cents = parseAmount(amount);
              await save({
                id: editing ?? crypto.randomUUID(),
                name: String(cents),
                cents,
              });
            },
            () => {
              setAmount("");
              setEditing(undefined);
            },
          );
        }}
      >
        <Field.Root>
          <Field.Label>{editing ? "Muokkaa summaa" : "Uusi summa"}</Field.Label>
          <Input
            aria-label="Pikaveloituksen summa"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field.Root>
        <Button type="submit" className="primary" disabled={busy || !amount}>
          {editing ? "Tallenna summa" : "Lisää summa"}
        </Button>
        {editing && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setEditing(undefined);
              setAmount("");
            }}
          >
            Peruuta muokkaus
          </Button>
        )}
      </form>
    </div>
  );
}
