import { useState } from "react";
import { Button, Field, Flex, Input } from "@chakra-ui/react";
import { BrandingSchema, LogoSchema, type Branding } from "./model";

export function BrandingForm({
  initial, busy, save, submitLabel = "Tallenna",
}: {
  initial: Branding;
  busy: boolean;
  save: (branding: Branding) => Promise<void>;
  submitLabel?: string;
}) {
  const [colors, setColors] = useState(initial);
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
  async function submit() {
    try {
      setError("");
      await save(BrandingSchema.parse(colors));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <>
        <form
          className="settings-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (readingLogo || busy) return;
            void submit();
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
            <Field.Label>Taustaväri</Field.Label>
            <Flex gap="3" align="center">
              <Input
                type="color"
                aria-label="Taustaväri"
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
              (colors.logo === initial.logo &&
                colors.organization === initial.organization &&
                colors.primary === initial.primary &&
                colors.secondary === initial.secondary)
            }
          >
            {submitLabel}
          </Button>
        </form>
      {error && <p role="alert" className="error">{error}</p>}
    </>
  );
}
