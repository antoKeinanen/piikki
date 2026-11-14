import { useState } from "react";
import { Button, Field, Input } from "@chakra-ui/react";
import { BrandingSchema, LogoSchema, type Branding } from "../../ledger";

const IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/svg+xml";

/** Styled image picker; the native file input is visually hidden so its English text never shows. */
function ImagePicker({
  id, pickLabel, fileName, image, previewAlt, clearLabel, disabled, onFile, onClear,
}: {
  id: string;
  pickLabel: string;
  fileName: string;
  image?: string;
  previewAlt: string;
  clearLabel: string;
  disabled: boolean;
  onFile(file: File): void;
  onClear(): void;
}) {
  return (
    <div className="image-picker">
      {image
        ? <img className="image-picker-preview" src={image} alt={previewAlt} />
        : <span className="image-picker-preview empty" aria-hidden="true" />}
      <div className="image-picker-main">
        <div className="image-picker-actions">
          <input
            id={id}
            className="visually-hidden"
            type="file"
            accept={IMAGE_TYPES}
            disabled={disabled}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) onFile(file);
              e.currentTarget.value = "";
            }}
          />
          <label htmlFor={id} className="image-picker-button" data-disabled={disabled || undefined}>
            {pickLabel}
          </label>
          {image && (
            <Button variant="ghost" className="image-picker-clear" disabled={disabled} onClick={onClear}>
              {clearLabel}
            </Button>
          )}
        </div>
        <span className="image-picker-name">{fileName}</span>
      </div>
    </div>
  );
}

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
  const [logoName, setLogoName] = useState("");
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
      if (logo.success) {
        setColors((current) => ({ ...current, logo: logo.data }));
        setLogoName(file.name);
      }
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
            <ImagePicker
              id="organization-logo"
              pickLabel={colors.logo ? "Vaihda logo" : "Valitse logo"}
              fileName={colors.logo ? logoName || "Nykyinen logo" : "Ei logoa. PNG, JPG, WebP tai SVG, enintään 1 Mt."}
              image={colors.logo}
              previewAlt="Logon esikatselu"
              clearLabel="Poista logo"
              disabled={busy || readingLogo}
              onFile={uploadLogo}
              onClear={() => {
                setColors((current) => ({ ...current, logo: undefined }));
                setLogoName("");
              }}
            />
          </Field.Root>
          <div className="color-rows">
            <Field.Root className="color-row">
              <Field.Label>Pääväri</Field.Label>
              <Input
                type="color"
                aria-label="Pääväri"
                value={colors.primary}
                onChange={(e) => setColors({ ...colors, primary: e.target.value })}
              />
              <span className="color-value">{colors.primary.toUpperCase()}</span>
            </Field.Root>
            <Field.Root className="color-row">
              <Field.Label>Taustaväri</Field.Label>
              <Input
                type="color"
                aria-label="Taustaväri"
                value={colors.secondary}
                onChange={(e) => setColors({ ...colors, secondary: e.target.value })}
              />
              <span className="color-value">{colors.secondary.toUpperCase()}</span>
            </Field.Root>
          </div>
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
