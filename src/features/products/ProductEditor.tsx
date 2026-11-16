import { useEffect, useRef, useState } from "react";
import {
  formatAmount,
  parseAmount,
  LogoSchema,
  type Product,
} from "../../ledger";
import {
  Field,
  IMAGE_ERROR,
  IMAGE_READ_ERROR,
  IMAGE_TYPES,
} from "../../ui/Field";

const EMPTY = {
  name: "",
  description: "",
  image: "",
  amount: "",
  category: "",
};

export function ProductEditor({
  products,
  busy,
  save,
  remove,
}: {
  products: Product[];
  busy: boolean;
  save(product: Product): Promise<void>;
  remove(id: string): Promise<void>;
}) {
  const [newDraft, setNewDraft] = useState(EMPTY);
  const [editDraft, setEditDraft] = useState(EMPTY);
  const [editing, setEditing] = useState<string>();
  const [removed, setRemoved] = useState<Product>();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const draft = editing ? editDraft : newDraft;
  const setDraft = editing ? setEditDraft : setNewDraft;
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!editing) return;
    nameInput.current?.scrollIntoView?.({
      block: "nearest",
      behavior: "smooth",
    });
    nameInput.current?.focus({ preventScroll: true });
  }, [editing]);
  const disabled = busy || reading;
  const categories = [
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "fi"));
  const editedName = products.find((p) => p.id === editing)?.name;
  const withImages = products.some((p) => p.image);
  function reset() {
    if (editing) setEditDraft(EMPTY);
    else setNewDraft(EMPTY);
    setEditing(undefined);
  }
  async function apply(operation: () => Promise<void>, done: () => void) {
    try {
      setError("");
      await operation();
      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  function upload(file: File) {
    setError("");
    if (file.size > 1_048_576 || !IMAGE_TYPES.includes(file.type)) {
      setError(IMAGE_ERROR);
      return;
    }
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const image = LogoSchema.safeParse(reader.result);
      if (image.success)
        setDraft((current) => ({ ...current, image: image.data }));
      else setError(IMAGE_READ_ERROR);
    };
    reader.onerror = () => setError(IMAGE_READ_ERROR);
    reader.onloadend = () => setReading(false);
    reader.readAsDataURL(file);
  }
  return (
    <div className="editor">
      <div className="editor-list">
        {!products.length && (
          <p className="empty-text">
            Ei vielä nimikkeitä. Lisää ensimmäinen lomakkeella.
          </p>
        )}
        <ul className="rows">
          {products.map((p) => (
            <li key={p.id} className={editing === p.id ? "row editing" : "row"}>
              {p.image ? (
                <img className="row-image" src={p.image} alt="" />
              ) : (
                withImages && <span className="row-image" />
              )}
              <span className="row-main">
                <span className="row-title">{p.name}</span>
                <span className="row-detail">
                  {p.category ? `${p.category} · ` : ""}
                  {formatAmount(p.cents)}
                </span>
              </span>
              {editing === p.id ? (
                <span className="badge" aria-live="polite">
                  Muokataan
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label={`Muokkaa ${p.name}`}
                  disabled={disabled}
                  onClick={() => {
                    setError("");
                    setEditing(p.id);
                    setEditDraft({
                      name: p.name,
                      description: p.description,
                      image: p.image,
                      amount: (p.cents / 100).toFixed(2).replace(".", ","),
                      category: p.category,
                    });
                  }}
                >
                  Muokkaa
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label={`Poista ${p.name}`}
                disabled={disabled}
                onClick={() =>
                  void apply(
                    () => remove(p.id),
                    () => {
                      setRemoved(p);
                      if (editing === p.id) reset();
                    },
                  )
                }
              >
                Poista
              </button>
            </li>
          ))}
        </ul>
        {removed && (
          <div className="inline-notice" role="status">
            <span>{removed.name} poistettu.</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={disabled}
              onClick={() =>
                void apply(
                  () => save(removed),
                  () => setRemoved(undefined),
                )
              }
            >
              Palauta {removed.name}
            </button>
          </div>
        )}
      </div>
      <form
        className="editor-form dialog-form"
        aria-label={editing ? `Muokkaa nimikettä ${editedName}` : "Uusi nimike"}
        onSubmit={(e) => {
          e.preventDefault();
          if (disabled) return;
          void apply(async () => {
            await save({
              id: editing ?? crypto.randomUUID(),
              name: draft.name,
              cents: parseAmount(draft.amount),
              description: draft.description,
              image: draft.image,
              category: draft.category,
            });
          }, reset);
        }}
      >
        <h3 className="section-title">
          {editing ? `Muokkaa: ${editedName}` : "Uusi nimike"}
        </h3>
        <Field label="Nimi">
          {(control) => (
            <input
              {...control}
              ref={nameInput}
              className="input"
              required
              maxLength={120}
              autoComplete="off"
              disabled={disabled}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          )}
        </Field>
        <Field label="Summa">
          {(control) => (
            <input
              {...control}
              className="input"
              required
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              disabled={disabled}
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            />
          )}
        </Field>
        <Field
          label="Kategoria (valinnainen)"
          hint="Saman kategorian nimikkeet ovat yhden painikkeen takana."
        >
          {(control) => (
            <>
              <input
                {...control}
                className="input"
                maxLength={60}
                list="product-categories"
                autoComplete="off"
                disabled={disabled}
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value })
                }
              />
              <datalist id="product-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
              {categories.length > 0 && (
                <div
                  className="chips"
                  role="group"
                  aria-label="Aiemmat kategoriat"
                >
                  {categories.map((category) => {
                    const selected = draft.category === category;
                    return (
                      <button
                        type="button"
                        key={category}
                        className="chip"
                        aria-pressed={selected}
                        disabled={disabled}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            category: selected ? "" : category,
                          })
                        }
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </Field>
        <Field
          label="Kuvaus (valinnainen)"
          hint="Haku löytää nimikkeen myös kuvauksen sanoilla."
        >
          {(control) => (
            <textarea
              {...control}
              className="input textarea"
              rows={2}
              maxLength={2000}
              disabled={disabled}
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          )}
        </Field>
        <Field label="Kuva (valinnainen)">
          {(control) => (
            <div className="image-picker">
              {draft.image && (
                <img
                  className="image-preview"
                  src={draft.image}
                  alt="Kuvan esikatselu"
                />
              )}
              <input
                {...control}
                type="file"
                className="file-input"
                accept={IMAGE_TYPES.join(",")}
                disabled={disabled}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) upload(file);
                  e.currentTarget.value = "";
                }}
              />
              {draft.image && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={disabled}
                  onClick={() => setDraft({ ...draft, image: "" })}
                >
                  Poista kuva
                </button>
              )}
            </div>
          )}
        </Field>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          {editing && (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={disabled}
              onClick={reset}
            >
              Peruuta
            </button>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={disabled || !draft.name.trim() || !draft.amount}
          >
            {editing ? "Tallenna nimike" : "Lisää nimike"}
          </button>
        </div>
      </form>
    </div>
  );
}
