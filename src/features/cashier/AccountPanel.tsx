import { useEffect, useRef, useState } from "react";
import bustedImage from "./busted.jpg";
import { Field } from "../../ui/Field";
import {
  formatAmount,
  parseAmount,
  type Customer,
  type Entry,
  type Product,
  type Ledger,
} from "../../ledger";

type PostInput = Omit<Parameters<Ledger["post"]>[0], "operator">;
/** Labels stored for charges made without an item. */
const GENERIC_CHARGE_LABELS = new Set(["Veloita", "Charge", "Purchase"]);
/** Same limits as parseAmount, so the button never shows an amount that will be refused. */
const AMOUNT = /^\d{1,7}([.,]\d{1,2})?$/;

export function entryTitle(entry: Entry) {
  if (entry.reversal_of) return "Peruutus";
  if (entry.opening) return "Alkusaldo";
  if (entry.cents > 0) return "Saldon lisäys";
  return GENERIC_CHARGE_LABELS.has(entry.label) ? "Veloitus" : entry.label;
}

export function signedAmount(cents: number) {
  return `${cents > 0 ? "+" : "−"}${formatAmount(Math.abs(cents))}`;
}

const time = (iso: string) =>
  new Date(iso).toLocaleString("fi-FI", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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
  onEdit,
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
  onEdit(): void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>();
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    // Every person starts from the same empty state, scrolled to the top.
    if (panel.current) panel.current.scrollTop = 0;
    setAmount("");
    setNote("");
    setSearch("");
    setCategory(undefined);
  }, [customer?.id, selectionRevision]);

  const query = search.trim().toLocaleLowerCase("fi");
  const categories = [
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ];
  // A search looks through every item. Otherwise categories come first.
  const browsing = !query && categories.length > 0;
  const openCategory =
    browsing && category !== undefined && categories.includes(category)
      ? category
      : undefined;
  const visibleProducts = products.filter((product) =>
    query
      ? `${product.name} ${product.description} ${product.category}`
          .toLocaleLowerCase("fi")
          .includes(query)
      : !browsing || product.category === (openCategory ?? ""),
  );
  const shownCategories =
    browsing && openCategory === undefined ? categories : [];

  function post(kind: "charge" | "deposit", product?: Product) {
    if (!customer || busy) return;
    try {
      const cents = product?.cents ?? parseAmount(amount);
      setError("");
      void onPost({
        customerId: customer.id,
        cents,
        kind,
        label:
          product?.name ?? (kind === "charge" ? "Veloita" : "Lisää saldoa"),
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

  if (!customer)
    return (
      <section className="account account-empty" aria-label="Valittu henkilö">
        <p className="empty-title">Valitse henkilö</p>
        <p className="empty-text">Hae nimellä tai lisää uusi henkilö.</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <figure className="busted" aria-hidden="true">
          <img src={bustedImage} alt="" />
          <figcaption>you have been busted</figcaption>
        </figure>
      </section>
    );

  const valid = AMOUNT.test(amount.trim());
  const typed = valid
    ? ` ${formatAmount(Math.round(Number(amount.trim().replace(",", ".")) * 100))}`
    : "";
  return (
    <section ref={panel} className="account" aria-label="Valittu henkilö">
      <header className="account-head">
        <div className="account-who">
          <h2 className="account-name" title={customer.name}>
            {customer.name}
          </h2>
          <p className="account-meta">
            {customer.osakunta || "Ei osakuntaa"}
            <button
              type="button"
              className="link-button"
              aria-label={`Muokkaa henkilöä ${customer.name}`}
              disabled={busy}
              onClick={() => {
                setError("");
                onEdit();
              }}
            >
              Muokkaa
            </button>
          </p>
          {/* Always rendered, so a note never moves the controls below. */}
          <p
            className={`account-note ${customer.note ? "" : "empty"}`}
            title={customer.note || undefined}
          >
            {customer.note}
          </p>
        </div>
        <div className="account-balance">
          <span className="balance-caption" aria-hidden="true">
            Saldo
          </span>
          <span
            className={`balance ${customer.balance < 0 ? "negative" : ""}`}
            aria-label="Saldo"
          >
            <span key={customer.balance} className="balance-value">
              {formatAmount(customer.balance)}
            </span>
          </span>
        </div>
      </header>

      <form
        className="amount-row"
        aria-label="Oma summa"
        // Enter does nothing, so a typed amount is never charged or added by accident.
        onSubmit={(e) => e.preventDefault()}
      >
        <Field label="Summa" className="amount-field">
          {(control) => (
            <input
              {...control}
              className="input"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={amount}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
        </Field>
        <Field label="Kuvaus (valinnainen)" className="note-field">
          {(control) => (
            <input
              {...control}
              className="input"
              autoComplete="off"
              maxLength={200}
              value={note}
              disabled={busy}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
        <button
          type="button"
          className="btn btn-charge"
          disabled={!amount.trim() || busy}
          onClick={() => post("charge")}
        >
          Veloita{typed}
        </button>
        <button
          type="button"
          className="btn btn-deposit"
          disabled={!amount.trim() || busy}
          onClick={() => post("deposit")}
        >
          Lisää saldoa{typed}
        </button>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {!!products.length && (
        <section className="products" aria-label="Nimikkeet">
          <div className="section-head">
            <h3 className="section-title">
              {openCategory ?? (query ? "Hakutulokset" : "Veloita nimike")}
            </h3>
            <input
              type="search"
              className="input input-sm product-search"
              aria-label="Hae nimikettä"
              placeholder="Hae nimikettä"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="product-grid">
            {openCategory !== undefined && (
              <button
                type="button"
                className="tile tile-back"
                disabled={busy}
                onClick={() => setCategory(undefined)}
              >
                <span className="tile-name">‹ Takaisin</span>
                <span className="tile-detail">Kaikki nimikkeet</span>
              </button>
            )}
            {shownCategories.map((name) => {
              const image = products.find(
                (p) => p.category === name && p.image,
              )?.image;
              const count = products.filter((p) => p.category === name).length;
              return (
                <button
                  type="button"
                  key={`category:${name}`}
                  className="tile tile-category"
                  aria-label={`Kategoria ${name}`}
                  disabled={busy}
                  onClick={() => setCategory(name)}
                >
                  {image && <img className="tile-image" src={image} alt="" />}
                  <span className="tile-name">{name} ›</span>
                  <span className="tile-detail">
                    {count === 1 ? "1 nimike" : `${count} nimikettä`}
                  </span>
                </button>
              );
            })}
            {visibleProducts.map((p) => (
              <button
                type="button"
                key={p.id}
                className="tile tile-product"
                aria-label={`Veloita ${p.name} ${formatAmount(p.cents)}`}
                disabled={busy}
                onClick={() => post("charge", p)}
              >
                {p.image && <img className="tile-image" src={p.image} alt="" />}
                <span className="tile-name">{p.name}</span>
                <span className="tile-detail">{formatAmount(p.cents)}</span>
              </button>
            ))}
          </div>
          {!visibleProducts.length && !shownCategories.length && (
            <p className="empty-text">
              Ei nimikkeitä haulla "{search.trim()}".
            </p>
          )}
        </section>
      )}

      <section className="history" aria-label="Kirjaukset">
        <h3 className="section-title">Kirjaukset</h3>
        {!entries.length && <p className="empty-text">Ei vielä kirjauksia.</p>}
        <ol className="entries">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={`entry ${entry.reversed ? "reversed" : ""}`}
            >
              <div className="entry-main">
                <span className="entry-label">{entryTitle(entry)}</span>
                {entry.note && <span className="entry-note">{entry.note}</span>}
                <span className="entry-meta">
                  {time(entry.created_at)}
                  {entry.operator ? ` · ${entry.operator}` : ""}
                  {entry.reversed ? " · Peruttu" : ""}
                </span>
              </div>
              <span
                className={`entry-amount ${entry.cents > 0 ? "positive" : "negative"}`}
              >
                {signedAmount(entry.cents)}
              </span>
              {!entry.reversal_of && !entry.reversed ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  aria-label={`Peru ${entryTitle(entry)} ${signedAmount(entry.cents)}`}
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    onReverse(entry);
                  }}
                >
                  Peru
                </button>
              ) : (
                <span />
              )}
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
