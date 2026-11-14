import { useEffect, useState, type ReactNode } from "react";
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
export function entryTitle(entry: Entry) {
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
  const [justPosted, setJustPosted] = useState(false);
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
  // Each category shows the photo of its first product that has one.
  const categoryImages = new Map<string, string>();
  for (const name of shownCategories) {
    const image = products.find((p) => p.category === name && p.image)?.image;
    if (image) categoryImages.set(name, image);
  }
  useEffect(() => {
    // A new person always starts from a charge with an empty form.
    setAction("charge");
    setAmount("");
    setNote("");
    setSearch("");
    setCategory(undefined);
    setJustPosted(false);
  }, [customer?.id, selectionRevision]);
  useEffect(() => {
    if (!justPosted) return;
    const timer = setTimeout(() => setJustPosted(false), 8000);
    return () => clearTimeout(timer);
  }, [justPosted, entries[0]?.id]);
  const latest = entries[0];
  const recorded = justPosted && latest && !latest.reversed && !latest.reversal_of ? latest : undefined;
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
          setJustPosted(true);
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
    setJustPosted(false);
  }
  const typed = amount.trim();
  const typedCents = /^\d+([.,]\d{1,2})?$/.test(typed)
    ? Math.round(Number(typed.replace(",", ".")) * 100)
    : undefined;
  const actionLabel = action === "charge" ? "Veloita" : "Lisää saldoa";
  const showPicker = action === "charge" && products.length > 0;
  // One fixed-height slot holds either the instruction or the receipt, so the
  // item tiles below never move when a charge is recorded.
  const feedback = customer && (
    <div className="recorded-slot">
      <div role="status">
        {recorded && (
          <div className={`recorded ${recorded.cents > 0 ? "positive" : "negative"}`}>
            <span className="recorded-check" aria-hidden="true">✓</span>
            <span className="recorded-body">
              <span className="recorded-line">
                {entryTitle(recorded)} kirjattu · {customer.name}
              </span>
              <span className="recorded-line recorded-change">
                <span className="recorded-amount">
                  {recorded.cents > 0 ? "+" : "−"}
                  {formatAmount(Math.abs(recorded.cents))}
                </span>
                {" · Saldo "}
                {formatAmount(customer.balance - recorded.cents)} →{" "}
                <strong>{formatAmount(customer.balance)}</strong>
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setError("");
                onReverse(recorded);
              }}
            >
              Kumoa
            </Button>
          </div>
        )}
      </div>
      {!recorded && (
        <Text className="product-hint">
          <svg className="product-hint-icon" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 7v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="4.75" r="1" fill="currentColor" />
          </svg>
          {action === "deposit"
            ? "Kirjoita lisättävä summa."
            : !products.length
              ? "Kirjoita veloitettava summa."
              : shownCategories.length && !visibleProducts.length
                ? "Valitse kategoria tai hae nimikettä."
                : "Nimike veloitetaan heti, kun napautat sitä."}
        </Text>
      )}
    </div>
  );
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
              <div className="account-name-row">
                <Text className="account-name" title={customer.name}>
                  {customer.name}
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
                  <svg className="edit-customer-icon" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M10.5 2.5l3 3L6 13H3v-3z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Muokkaa henkilöä
                </Button>
              </div>
              {customer.osakunta && <Text className="account-osakunta">{customer.osakunta}</Text>}
            </div>
            <div className="balance-block">
              <span className="balance-label" aria-hidden="true">Saldo</span>
              <Text className={`balance ${customer.balance < 0 ? "negative" : ""}`} aria-label="Saldo">
                {formatAmount(customer.balance)}
              </Text>
            </div>
          </div>
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
          {!showPicker && feedback}
          {showPicker && (
            <div className="product-picker">
              <Input aria-label="Hae nimikettä" placeholder="Hae nimikettä" value={search}
                onChange={(e) => setSearch(e.target.value)} />
              {openCategory !== undefined && (
                <div className="category-crumbs">
                  <Button
                    variant="ghost"
                    className="category-crumb"
                    disabled={busy}
                    onClick={() => setCategory(undefined)}
                  >
                    <span className="category-crumb-chevron" aria-hidden="true">‹</span>
                    Kaikki kategoriat
                  </Button>
                  <span className="category-crumb-separator" aria-hidden="true">/</span>
                  <span className="category-crumb-current" aria-current="location">{openCategory}</span>
                </div>
              )}
              {feedback}
              <div className="product-grid">
                {shownCategories.map((name) => (
                  <Button
                    key={`category:${name}`}
                    variant="outline"
                    className="product-charge category-button"
                    aria-label={`Kategoria ${name}`}
                    disabled={busy}
                    onClick={() => setCategory(name)}
                  >
                    <span className="category-top">
                      {categoryImages.has(name) && <img className="product-thumbnail" src={categoryImages.get(name)} alt="" />}
                      <span className="category-chevron" aria-hidden="true">›</span>
                    </span>
                    <span>
                      {name}
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
                    <span>{p.name}</span>
                    <span className="product-price">Veloita {formatAmount(p.cents)}</span>
                  </Button>
                ))}
              </div>
              {!visibleProducts.length && !shownCategories.length && <Text>Nimikkeitä ei löytynyt.</Text>}
            </div>
          )}
          <form
            className="amount-form"
            onSubmit={(e) => {
              e.preventDefault();
              post(action);
            }}
          >
            <FormField
              label={action === "charge" ? "Veloitettava summa" : "Lisättävä summa"}
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
              disabled={!typed || busy}
            >
              {!typed
                ? `${actionLabel} ${formatAmount(0)}`
                : typedCents !== undefined
                  ? `${actionLabel} ${formatAmount(typedCents)}`
                  : actionLabel}
            </Button>
            {typedCents !== undefined && (
              <Text className="amount-preview">
                Saldo {formatAmount(customer.balance)} →{" "}
                <strong>
                  {formatAmount(customer.balance + (action === "charge" ? -typedCents : typedCents))}
                </strong>
              </Text>
            )}
          </form>
          {error && (
            <Text role="alert" className="error">
              {error}
            </Text>
          )}
          <CustomerNoteForm
            key={customer.id}
            customer={customer}
            busy={busy}
            save={onSaveNote}
          />
          <div className="history" aria-label="Tapahtumat">
            <h3 className="history-title">Tapahtumat</h3>
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
                    {entry.reversed ? " · Kumottu" : ""}
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
                    Kumoa
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
          <div className="empty-account">
            <h2 className="empty-account-title">Valitse henkilö listasta</h2>
            <Text className="empty-account-text">
              Saldo ja veloitukset näkyvät tässä. Voit myös hakea nimellä tai lisätä uuden henkilön.
            </Text>
          </div>
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
