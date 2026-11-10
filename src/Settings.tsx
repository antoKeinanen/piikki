import { useState, type ReactNode } from "react";
import { Button, Field, Input, Tabs } from "@chakra-ui/react";
import {
  formatAmount,
  parseAmount,
  type Preset,
  type Snapshot,
} from "./model";
import { BrandingForm } from "./BrandingForm";
import { type Ledger } from "./ledger";

export function Settings({
  ledger,
  snapshot,
  run,
  busy,
  files,
}: {
  ledger: Ledger;
  snapshot: Snapshot;
  run: (operation: () => Promise<void>) => Promise<void>;
  busy: boolean;
  files: ReactNode;
}) {
  const [amount, setAmount] = useState("");
  const [editing, setEditing] = useState<string>();
  const [removed, setRemoved] = useState<Preset>();
  const [error, setError] = useState("");
  async function apply(operation: () => Promise<void>, done?: () => void) {
    try {
      setError("");
      await run(operation);
      done?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <Tabs.Root defaultValue="branding" variant="line" className="settings-tabs">
      <Tabs.List>
        <Tabs.Trigger value="branding">Ulkoasu</Tabs.Trigger>
        <Tabs.Trigger value="charges">Pikaveloitukset</Tabs.Trigger>
        <Tabs.Trigger value="files">Tietokanta</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="branding">
        <BrandingForm
          initial={snapshot.branding}
          busy={busy}
          save={(branding) => run(() => ledger.saveBranding(branding))}
        />
      </Tabs.Content>
      <Tabs.Content value="charges">
        <div className="settings-form">
          <div className="preset-list">
            {snapshot.presets.map((p) => (
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
                      () => ledger.removePreset(p.id),
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
                  () => ledger.savePreset(removed),
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
                  await ledger.savePreset({
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
              <Field.Label>
                {editing ? "Muokkaa summaa" : "Uusi summa"}
              </Field.Label>
              <Input
                aria-label="Pikaveloituksen summa"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field.Root>
            <Button
              type="submit"
              className="primary"
              disabled={busy || !amount}
            >
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
      </Tabs.Content>
      <Tabs.Content value="files">
        <div className="settings-files">{files}</div>
      </Tabs.Content>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </Tabs.Root>
  );
}
