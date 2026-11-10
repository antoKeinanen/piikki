import { useState, type ReactNode } from "react";
import { Button, Field, Flex, Input, Tabs } from "@chakra-ui/react";
import {
  BrandingSchema,
  formatAmount,
  parseAmount,
  type Preset,
  type Snapshot,
} from "./model";
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
  const [colors, setColors] = useState(snapshot.branding);
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
        <Tabs.Trigger value="branding">Branding</Tabs.Trigger>
        <Tabs.Trigger value="charges">Quick charges</Tabs.Trigger>
        <Tabs.Trigger value="files">Database</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="branding">
        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            void apply(async () => {
              await ledger.saveBranding(BrandingSchema.parse(colors));
            });
          }}
        >
          <Field.Root>
            <Field.Label>Primary color</Field.Label>
            <Flex gap="3" align="center">
              <Input
                type="color"
                aria-label="Primary color"
                value={colors.primary}
                onChange={(e) =>
                  setColors({ ...colors, primary: e.target.value })
                }
              />
              <span className="color-value">
                {colors.primary.toUpperCase()}
              </span>
            </Flex>
          </Field.Root>
          <Field.Root>
            <Field.Label>Secondary color</Field.Label>
            <Flex gap="3" align="center">
              <Input
                type="color"
                aria-label="Secondary color"
                value={colors.secondary}
                onChange={(e) =>
                  setColors({ ...colors, secondary: e.target.value })
                }
              />
              <span className="color-value">
                {colors.secondary.toUpperCase()}
              </span>
            </Flex>
          </Field.Root>
          <Button
            className="primary"
            type="submit"
            disabled={
              busy ||
              (colors.primary === snapshot.branding.primary &&
                colors.secondary === snapshot.branding.secondary)
            }
          >
            Save colors
          </Button>
        </form>
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
                  Edit
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
                  Remove
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
              Restore {formatAmount(removed.cents)}
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
                {editing ? "Edit amount" : "New amount"}
              </Field.Label>
              <Input
                aria-label="Quick charge amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field.Root>
            <Button
              type="submit"
              className="primary"
              disabled={busy || !amount}
            >
              {editing ? "Save amount" : "Add amount"}
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
                Cancel edit
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
