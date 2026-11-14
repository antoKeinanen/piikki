import { useEffect, useRef, useState } from "react";
import { Button, Field, Input, Textarea } from "@chakra-ui/react";
import { formatAmount, parseAmount, LogoSchema, type Product } from "../../ledger";

const IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/svg+xml";

/** Same picker as the branding form; features cannot share modules. */
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

export function ProductEditor({
  products, busy, save, remove, setError,
}: {
  products: Product[];
  busy: boolean;
  save(product: Product): Promise<void>;
  remove(id: string): Promise<void>;
  setError(message: string): void;
}) {
  const empty = { name: "", description: "", image: "", amount: "", category: "" };
  const [newDraft, setNewDraft] = useState(empty);
  const [editDraft, setEditDraft] = useState(empty);
  const [editing, setEditing] = useState<string>();
  const draft = editing ? editDraft : newDraft;
  const setDraft = editing ? setEditDraft : setNewDraft;
  const editPanel = useRef<HTMLDivElement>(null);
  const newSection = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!editing) return;
    editPanel.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    editPanel.current?.querySelector("input")?.focus({ preventScroll: true });
  }, [editing]);
  // Removal is undoable, so instead of a confirm step the row stays in place with a restore action.
  const [removed, setRemoved] = useState<{ product: Product; index: number }>();
  const [reading, setReading] = useState(false);
  const disabled = busy || reading;
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fi"));
  function reset() {
    if (editing) setEditDraft(empty);
    else setNewDraft(empty);
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
    if (file.size > 1_048_576 || !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
      setError("Valitse PNG-, JPG-, WebP- tai SVG-kuva (enintään 1 Mt).");
      return;
    }
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const image = LogoSchema.safeParse(reader.result);
      if (image.success) setDraft((current) => ({ ...current, image: image.data }));
      else setError("Kuvan lukeminen epäonnistui.");
    };
    reader.onerror = () => setError("Kuvan lukeminen epäonnistui.");
    reader.onloadend = () => setReading(false);
    reader.readAsDataURL(file);
  }
  const form = (
    <form className="settings-form" onSubmit={(e) => {
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
    }}>
      <Field.Root>
        <Field.Label>Nimikkeen nimi</Field.Label>
        <Input required maxLength={120} disabled={disabled} value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </Field.Root>
      <Field.Root>
        <Field.Label>Nimikkeen summa</Field.Label>
        <Input required inputMode="decimal" placeholder="0,00" disabled={disabled} value={draft.amount}
          onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
      </Field.Root>
      <Field.Root>
        <Field.Label>Kategoria (valinnainen)</Field.Label>
        <Input maxLength={60} list="product-categories" placeholder="esim. Tölkki tai Vahva" disabled={disabled}
          value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
        <datalist id="product-categories">
          {categories.map((category) => <option key={category} value={category} />)}
        </datalist>
        {categories.length > 0 && (
          <div className="category-chips" role="group" aria-label="Aiemmat kategoriat">
            {categories.map((category) => {
              const selected = draft.category === category;
              return (
                <button type="button" key={category} className={selected ? "category-chip selected" : "category-chip"}
                  aria-pressed={selected} disabled={disabled}
                  onClick={() => setDraft({ ...draft, category: selected ? "" : category })}>
                  {category}
                </button>
              );
            })}
          </div>
        )}
        <Field.HelperText>Saman kategorian nimikkeet näytetään veloitusnäkymässä yhden painikkeen takana.</Field.HelperText>
      </Field.Root>
      <Field.Root>
        <Field.Label>Kuvaus</Field.Label>
        <Textarea maxLength={2000} disabled={disabled} value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      </Field.Root>
      <Field.Root>
        <Field.Label htmlFor="product-image">Nimikkeen kuva</Field.Label>
        <ImagePicker
          id="product-image"
          pickLabel={draft.image ? "Vaihda kuva" : "Valitse kuva"}
          fileName={draft.image ? "Kuva valittu" : "Ei kuvaa. PNG, JPG, WebP tai SVG, enintään 1 Mt."}
          image={draft.image || undefined}
          previewAlt="Nimikkeen kuvan esikatselu"
          clearLabel="Poista kuva"
          disabled={disabled}
          onFile={upload}
          onClear={() => setDraft({ ...draft, image: "" })}
        />
      </Field.Root>
      <Button type="submit" className="primary" disabled={disabled || !draft.name.trim() || !draft.amount}>
        Tallenna nimike
      </Button>
      {editing && <Button variant="outline" className="secondary" disabled={disabled} onClick={reset}>Peruuta muokkaus</Button>}
    </form>
  );
  const rows = products.map((p) => (
    <div key={p.id} className={editing === p.id ? "product-item editing" : "product-item"}>
      <div className="product-row">
        {p.image && <img className="product-thumbnail" src={p.image} alt="" />}
        <span>{p.name}<small>{p.category ? `${p.category} · ` : ""}{formatAmount(p.cents)}</small></span>
        <div className="product-row-actions">
          {editing === p.id
            ? <span className="product-editing-badge" aria-live="polite">Muokataan</span>
            : <Button variant="outline" disabled={disabled} onClick={() => {
                setEditing(p.id);
                setEditDraft({ name: p.name, description: p.description, image: p.image, amount: (p.cents / 100).toFixed(2), category: p.category });
              }}>Muokkaa</Button>}
          <Button variant="outline" className="danger-outline" disabled={disabled} onClick={() => void apply(
            () => remove(p.id),
            () => { setRemoved({ product: p, index: products.indexOf(p) }); if (editing === p.id) reset(); },
          )}>Poista</Button>
        </div>
      </div>
      {editing === p.id && <div className="product-edit-panel" ref={editPanel}>{form}</div>}
    </div>
  ));
  if (removed) rows.splice(Math.min(removed.index, rows.length), 0, (
    <div key="removed" className="product-row product-removed" role="status">
      <span>{removed.product.name}<small>Poistettu</small></span>
      <div className="product-row-actions">
        <Button variant="outline" disabled={disabled} onClick={() => void apply(
          () => save(removed.product), () => setRemoved(undefined),
        )}>Palauta {removed.product.name}</Button>
      </div>
    </div>
  ));
  return (
    <div className="settings-form">
      <div className="settings-toolbar">
        <h3 className="settings-section-title">Nimikkeet</h3>
        {!editing && <Button variant="outline" className="secondary" disabled={disabled} onClick={() => {
          newSection.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
          newSection.current?.querySelector("input")?.focus({ preventScroll: true });
        }}>Lisää nimike</Button>}
      </div>
      <div className="product-list">{rows}</div>
      {!editing && <section className="product-new" ref={newSection} aria-labelledby="product-new-title">
        <h3 id="product-new-title" className="product-section-title">Lisää uusi nimike</h3>
        {form}
      </section>}
    </div>
  );
}
