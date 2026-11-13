import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Field, Flex, Input, Text } from "@chakra-ui/react";
import { CustomerNoteForm } from "./CustomerNoteForm";
import bustedImage from "./busted.jpg";
import {
  formatAmount,
  parseAmount,
  type Customer,
  type Entry,
  type Product,
  type Ledger,
} from "../../ledger";
function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      {children}
    </Field.Root>
  );
}
type PostInput = Omit<Parameters<Ledger["post"]>[0], "operator">;
const GENERIC_CHARGE_LABELS = new Set(["Veloita", "Charge", "Purchase"]);
function entryTitle(entry: Entry) {
  if (entry.reversal_of) return "Hyvitys";
  if (entry.opening) return "Alkusaldo";
  if (entry.cents > 0) return "Saldon lisäys";
  // Charges without a product button store a generic label.
  return GENERIC_CHARGE_LABELS.has(entry.label) ? "Veloitus" : entry.label;
}
export function AccountPanel({
  selectionRevision,
  customer,
  entries,
  products,
  busy,
  error,
  setError,
  onPost,
  onReverse,
  onSaveNote,
  onEdit,
  notice,
}: {
  selectionRevision: number;
  customer: Customer | undefined;
  entries: Entry[];
  products: Product[];
  busy: boolean;
  error: string;
  setError(message: string): void;
  onPost(input: PostInput): Promise<void>;
  onReverse(entry: Entry): void;
  onSaveNote(customerId: string, note: string): Promise<void>;
  onEdit(): void;
  notice?: ReactNode;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [action, setAction] = useState<"charge" | "deposit">("charge");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>();
  const query = search.trim().toLocaleLowerCase("fi");
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
  // Searching looks through every product; otherwise categories come first.
  const browsing = !query && categories.length > 0;
  const openCategory = browsing && category !== undefined && categories.includes(category) ? category : undefined;
  const visibleProducts = products.filter((product) =>
    query
      ? (product.name + " " + product.description + " " + product.category)
          .toLocaleLowerCase("fi")
          .includes(query)
      : !browsing || product.category === (openCategory ?? ""),
  );
  const shownCategories = browsing && openCategory === undefined ? categories : [];
  // Each time the category list appears, every category shows a random photo from its products.
  const categoryImages = useMemo(() => {
    const images = new Map<string, string>();
    for (const name of shownCategories) {
      const photos = products.filter((p) => p.category === name && p.image).map((p) => p.image);
      if (photos.length) images.set(name, photos[Math.floor(Math.random() * photos.length)]);
    }
    return images;
    // shownCategories is rebuilt on every render, so its contents form the key instead.
  }, [products, shownCategories.join("\u0000"), customer?.id, selectionRevision]);
  useEffect(() => {
    // A new person always starts from a charge with an empty form.
    setAction("charge");
    setAmount("");
    setNote("");
    setSearch("");
    setCategory(undefined);
  }, [customer?.id, selectionRevision]);
  function post(kind: "charge" | "deposit", product?: Product) {
    if (!customer || busy) return;
    try {
      const cents = product?.cents ?? parseAmount(amount);
      setError("");
      void onPost({
        customerId: customer.id,
        cents,
        kind,
        label: product?.name ?? (kind === "charge" ? "Veloita" : "Lisää saldoa"),
        note,
      }).then(
        () => {
          if (!product) setAmount("");
          setNote("");
        },
        () => {},
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  function switchMode(next: "charge" | "deposit") {
    setAction(next);
    setAmount("");
    setError("");
  }
  const validAmount = amount && /^\d+([.,]\d{1,2})?$/.test(amount.trim());
  return (
    <section
      className={`account ${customer ? `mode-${action}` : ""}`}
      aria-label="Valittu henkilö"
    >
      {notice}
      {customer ? (
        <>
          <div className="account-summary">
            <div className="account-identity">
              <Text className="account-name" title={customer.name}>
                {customer.name}{customer.osakunta && ` • ${customer.osakunta}`}
              </Text>
              <Button
                variant="ghost"
                size="sm"
                className="edit-customer"
                aria-label={`Muokkaa henkilöä ${customer.name}`}
                disabled={busy}
                onClick={() => {
                  setError("");
                  onEdit();
                }}
              >
                Muokkaa
              </Button>
            </div>
            <Text className="balance" aria-label="Saldo">
              {formatAmount(customer.balance)}
            </Text>
          </div>
          <CustomerNoteForm
            key={customer.id}
            customer={customer}
            busy={busy}
            save={onSaveNote}
          />
          <Flex className="mode" role="group" aria-label="Tapahtuman tyyppi">
            <Button
              variant="plain"
              className={`mode-charge-tab ${action === "charge" ? "mode-active" : ""}`}
              aria-pressed={action === "charge"}
              disabled={busy}
              onClick={() => switchMode("charge")}
            >
              <span aria-hidden="true" className="mode-sign">−</span>Veloita
            </Button>
            <Button
              variant="plain"
              className={`mode-deposit-tab ${action === "deposit" ? "mode-active" : ""}`}
              aria-pressed={action === "deposit"}
              disabled={busy}
              onClick={() => switchMode("deposit")}
            >
              <span aria-hidden="true" className="mode-sign">+</span>Lisää saldoa
            </Button>
          </Flex>
          <form
            className="amount-form"
            onSubmit={(e) => {
              e.preventDefault();
              post(action);
            }}
          >
            <FormField
              label={action === "charge" ? "Muu summa" : "Lisättävä summa"}
            >
              <Input
                aria-label="Summa"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                disabled={busy}
                onChange={(e) => setAmount(e.target.value)}
              />
            </FormField>
            <FormField label="Kuvaus (valinnainen)">
              <Input
                aria-label="Tapahtuman kuvaus"
                maxLength={200}
                value={note}
                disabled={busy}
                onChange={(e) => setNote(e.target.value)}
              />
            </FormField>
            <Button
              className="primary mode-submit"
              type="submit"
              disabled={!amount || busy}
            >
              {action === "charge" ? "Veloita" : "Lisää saldoa"}
              {validAmount
                ? ` ${formatAmount(Math.round(Number(amount.trim().replace(",", ".")) * 100))}`
                : ""}
            </Button>
          </form>
          {error && (
            <Text role="alert" className="error">
              {error}
            </Text>
          )}
          {action === "charge" && !!products.length && (
            <div className="product-picker">
              <Input aria-label="Hae nimikettä" placeholder="Hae nimikettä" value={search}
                onChange={(e) => setSearch(e.target.value)} />
              <div className="product-grid">
                {openCategory !== undefined && (
                  <Button
                    variant="outline"
                    className="product-charge category-back"
                    disabled={busy}
                    onClick={() => setCategory(undefined)}
                  >
                    <span>‹ Takaisin<small>{openCategory}</small></span>
                  </Button>
                )}
                {shownCategories.map((name) => (
                  <Button
                    key={`category:${name}`}
                    variant="outline"
                    className="product-charge category-button"
                    aria-label={`Kategoria ${name}`}
                    disabled={busy}
                    onClick={() => setCategory(name)}
                  >
                    {categoryImages.has(name) && <img className="product-thumbnail" src={categoryImages.get(name)} alt="" />}
                    <span>
                      {name} ›
                      <small>{products.filter((p) => p.category === name).length} nimikettä</small>
                    </span>
                  </Button>
                ))}
                {visibleProducts.map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    className="product-charge"
                    aria-label={`Veloita ${p.name} ${formatAmount(p.cents)}`}
                    disabled={busy}
                    onClick={() => post("charge", p)}
                  >
                    {p.image && <img className="product-thumbnail" src={p.image} alt="" />}
                    <span>{p.name}<small>{formatAmount(p.cents)}</small></span>
                  </Button>
                ))}
              </div>
              {!visibleProducts.length && !shownCategories.length && <Text>Nimikkeitä ei löytynyt.</Text>}
            </div>
          )}
          <div className="history" aria-label="Tapahtumat">
            {!entries.length && (
              <Text className="empty-history">Ei tapahtumia.</Text>
            )}
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`entry ${entry.reversed ? "reversed" : ""}`}
              >
                <div>
                  <Text className="entry-label">{entryTitle(entry)}</Text>
                  {entry.note && <Text className="entry-note">{entry.note}</Text>}
                  <Text className="entry-date">
                    {new Date(entry.created_at).toLocaleString("fi-FI", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {entry.reversed ? " · Peruttu" : ""}
                    {entry.operator ? ` · ${entry.operator}` : ""}
                  </Text>
                </div>
                <Text className={`entry-amount ${entry.cents > 0 ? "positive" : "negative"}`}>
                  {entry.cents > 0 ? "+" : "−"}
                  {formatAmount(Math.abs(entry.cents))}
                </Text>
                {!entry.reversal_of && !entry.reversed ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setError("");
                      onReverse(entry);
                    }}
                  >
                    Peru
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <Text className="empty-account">Valitse tai lisää henkilö.</Text>
          <figure className="busted" aria-hidden="true">
            <img src={bustedImage} alt="" />
            <figcaption>you have been busted</figcaption>
          </figure>
        </>
      )}
      {error && !customer && (
        <Text role="alert" className="error">
          {error}
        </Text>
      )}
    </section>
  );
}
