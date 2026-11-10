import { useState, type ReactNode } from "react";
import { Button, Field, Flex, Input, Tabs } from "@chakra-ui/react";
import {
  BrandingSchema,
  LogoSchema,
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
  const [readingLogo, setReadingLogo] = useState(false);
  function uploadLogo(file: File) {
    setError("");
    if (file.size > 1_048_576 || !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
      setError("Valitse PNG-, JPG-, WebP- tai SVG-kuva (enintään 1 Mt).");
      return;
    }
    setReadingLogo(true);
    const reader = new FileReader();
    reader.onload = () => {
      const logo = LogoSchema.safeParse(reader.result);
      if (logo.success) setColors((current) => ({ ...current, logo: logo.data }));
      else setError("Kuvan lukeminen epäonnistui.");
    };
    reader.onerror = () => setError("Kuvan lukeminen epäonnistui.");
    reader.onloadend = () => setReadingLogo(false);
    reader.readAsDataURL(file);
  }
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
        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (readingLogo || busy) return;
            void apply(async () => {
              await ledger.saveBranding(BrandingSchema.parse(colors));
            });
          }}
        >
          <Field.Root>
            <Field.Label>Osakunta</Field.Label>
            <Input
              required
              maxLength={60}
              value={colors.organization}
              onChange={(e) => setColors({ ...colors, organization: e.target.value })}
            />
          </Field.Root>
          <Field.Root>
            <Field.Label htmlFor="organization-logo">Logo</Field.Label>
            <input
              id="organization-logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={busy || readingLogo}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) uploadLogo(file);
                e.currentTarget.value = "";
              }}
            />
            {colors.logo && (
              <Flex align="center" gap="3">
                <img className="logo-preview" src={colors.logo} alt="Logon esikatselu" />
                <Button
                  variant="ghost"
                  disabled={busy || readingLogo}
                  onClick={() => setColors((current) => ({ ...current, logo: undefined }))}
                >
                  Poista logo
                </Button>
              </Flex>
            )}
          </Field.Root>
          <Field.Root>
            <Field.Label>Pääväri</Field.Label>
            <Flex gap="3" align="center">
              <Input
                type="color"
                aria-label="Pääväri"
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
            <Field.Label>Toinen väri</Field.Label>
            <Flex gap="3" align="center">
              <Input
                type="color"
                aria-label="Toinen väri"
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
              readingLogo ||
              !colors.organization.trim() ||
              (colors.logo === snapshot.branding.logo &&
                colors.organization === snapshot.branding.organization &&
                colors.primary === snapshot.branding.primary &&
                colors.secondary === snapshot.branding.secondary)
            }
          >
            Tallenna
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
