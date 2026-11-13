import { useState } from "react";
import { Button, Field, Input, Textarea } from "@chakra-ui/react";
import { formatAmount, parseAmount, LogoSchema, type Product } from "../../ledger";

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
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState<string>();
  const [removed, setRemoved] = useState<Product>();
  const [reading, setReading] = useState(false);
  const disabled = busy || reading;
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
  function reset() {
    setDraft(empty);
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
  return (
    <div className="settings-form">
      <div className="product-list">
        {products.map((p) => (
          <div className="product-row" key={p.id}>
            {p.image && <img className="product-thumbnail" src={p.image} alt="" />}
            <span>{p.name}<small>{p.category ? `${p.category} · ` : ""}{formatAmount(p.cents)}</small></span>
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => {
              setEditing(p.id);
              setDraft({ name: p.name, description: p.description, image: p.image, amount: (p.cents / 100).toFixed(2), category: p.category });
            }}>Muokkaa</Button>
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => void apply(
              () => remove(p.id),
              () => { setRemoved(p); if (editing === p.id) reset(); },
            )}>Poista</Button>
          </div>
        ))}
      </div>
      {removed && <Button variant="outline" disabled={disabled} onClick={() => void apply(
        () => save(removed), () => setRemoved(undefined),
      )}>Palauta {removed.name}</Button>}
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
          <Field.HelperText>Saman kategorian nimikkeet näytetään kassalla yhden painikkeen takana.</Field.HelperText>
        </Field.Root>
        <Field.Root>
          <Field.Label>Kuvaus</Field.Label>
          <Textarea maxLength={2000} disabled={disabled} value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </Field.Root>
        <Field.Root>
          <Field.Label htmlFor="product-image">Nimikkeen kuva</Field.Label>
          <input id="product-image" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"
            disabled={disabled} onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) upload(file);
              e.currentTarget.value = "";
            }} />
          {draft.image && <>
            <img className="logo-preview" src={draft.image} alt="Nimikkeen kuvan esikatselu" />
            <Button variant="ghost" disabled={disabled} onClick={() => setDraft({ ...draft, image: "" })}>Poista kuva</Button>
          </>}
        </Field.Root>
        <Button type="submit" className="primary" disabled={disabled || !draft.name.trim() || !draft.amount}>
          {editing ? "Tallenna nimike" : "Lisää nimike"}
        </Button>
        {editing && <Button variant="ghost" disabled={disabled} onClick={reset}>Peruuta muokkaus</Button>}
      </form>
    </div>
  );
}
