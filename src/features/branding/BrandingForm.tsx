import { useState, type ReactNode } from "react";
import { BrandingSchema, LogoSchema, type Branding } from "../../ledger";
import { Field, IMAGE_ERROR, IMAGE_READ_ERROR, IMAGE_TYPES } from "../../ui/Field";

export function BrandingForm({
  initial,
  busy,
  save,
  submitLabel = "Tallenna",
  actions,
}: {
  initial: Branding;
  busy: boolean;
  save: (branding: Branding) => Promise<void>;
  submitLabel?: string;
  /** Wraps the submit button, so a dialog can add its cancel button. */
  actions?: (submit: ReactNode) => ReactNode;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState("");
  const [readingLogo, setReadingLogo] = useState(false);
  function uploadLogo(file: File) {
    setError("");
    if (file.size > 1_048_576 || !IMAGE_TYPES.includes(file.type)) {
      setError(IMAGE_ERROR);
      return;
    }
    setReadingLogo(true);
    const reader = new FileReader();
    reader.onload = () => {
      const logo = LogoSchema.safeParse(reader.result);
      if (logo.success) setValues((current) => ({ ...current, logo: logo.data }));
      else setError(IMAGE_READ_ERROR);
    };
    reader.onerror = () => setError(IMAGE_READ_ERROR);
    reader.onloadend = () => setReadingLogo(false);
    reader.readAsDataURL(file);
  }
  async function submit() {
    try {
      setError("");
      await save(BrandingSchema.parse(values));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  const submitButton = (
    <button
      className="btn btn-primary"
      type="submit"
      disabled={
        busy ||
        readingLogo ||
        !values.organization.trim() ||
        (values.logo === initial.logo &&
          values.organization === initial.organization &&
          values.primary === initial.primary &&
          values.secondary === initial.secondary)
      }
    >
      {submitLabel}
    </button>
  );
  return (
    <form
      className="dialog-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (readingLogo || busy) return;
        void submit();
      }}
    >
      <Field label="Osakunnan nimi">
        {(control) => (
          <input
            {...control}
            className="input"
            required
            maxLength={60}
            value={values.organization}
            onChange={(e) => setValues({ ...values, organization: e.target.value })}
          />
        )}
      </Field>
      <Field label="Logo" hint="PNG, JPG, WebP tai SVG, enintään 1 Mt.">
        {(control) => (
          <div className="image-picker">
            {values.logo && <img className="image-preview" src={values.logo} alt="Logon esikatselu" />}
            <input
              {...control}
              type="file"
              className="file-input"
              accept={IMAGE_TYPES.join(",")}
              disabled={busy || readingLogo}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) uploadLogo(file);
                e.currentTarget.value = "";
              }}
            />
            {values.logo && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy || readingLogo}
                onClick={() => setValues((current) => ({ ...current, logo: undefined }))}
              >
                Poista logo
              </button>
            )}
          </div>
        )}
      </Field>
      <div className="color-fields">
        <Field label="Pääväri" hint="Valittu henkilö ja päätoiminnot.">
          {(control) => (
            <div className="color-picker">
              <input
                {...control}
                type="color"
                value={values.primary}
                onChange={(e) => setValues({ ...values, primary: e.target.value })}
              />
              <span className="color-value">{values.primary.toUpperCase()}</span>
            </div>
          )}
        </Field>
        <Field label="Taustaväri">
          {(control) => (
            <div className="color-picker">
              <input
                {...control}
                type="color"
                value={values.secondary}
                onChange={(e) => setValues({ ...values, secondary: e.target.value })}
              />
              <span className="color-value">{values.secondary.toUpperCase()}</span>
            </div>
          )}
        </Field>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {actions ? actions(submitButton) : <div className="button-row">{submitButton}</div>}
    </form>
  );
}
