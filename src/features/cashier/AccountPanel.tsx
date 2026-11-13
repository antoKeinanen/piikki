import { useEffect, useState, type ReactNode } from "react";
import { Button, Field, Flex, Input, Text } from "@chakra-ui/react";
import { CustomerNoteForm } from "./CustomerNoteForm";
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
}: {
  selectionRevision: number;
  customer: Customer | undefined;
  entries: Entry[];
  products: Product[];
  busy: boolean;
  error: string;
  setError(message: string): void;
  onPost(input: Parameters<Ledger["post"]>[0]): Promise<void>;
  onReverse(entry: Entry): void;
  onSaveNote(customerId: string, note: string): Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [action, setAction] = useState<"charge" | "deposit">("charge");
  const [search, setSearch] = useState("");
  const query = search.trim().toLocaleLowerCase("fi");
  const visibleProducts = products.filter((product) =>
    (product.name + " " + product.description).toLocaleLowerCase("fi").includes(query),
  );
  useEffect(() => {
    setAmount("");
    setSearch("");
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
      }).then(
        () => setAmount(""),
        () => {},
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <section className="account" aria-label="Valittu henkilö">
      {customer ? (
        <>
          <div className="account-summary">
            <Text className="account-name">{customer.name}{customer.osakunta && ` • ${customer.osakunta}`}</Text>
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
              className={action === "charge" ? "mode-active" : ""}
              aria-pressed={action === "charge"}
              disabled={busy}
              onClick={() => {
                setAction("charge");
                setAmount("");
                setError("");
              }}
            >
              Veloita
            </Button>
            <Button
              variant="plain"
              className={action === "deposit" ? "mode-active" : ""}
              aria-pressed={action === "deposit"}
              disabled={busy}
              onClick={() => {
                setAction("deposit");
                setAmount("");
                setError("");
              }}
            >
              Lisää saldoa
            </Button>
          </Flex>
          {action === "charge" && !!products.length && (
            <div className="product-picker">
              <Input aria-label="Hae nimikettä" placeholder="Hae nimikettä" value={search}
                onChange={(e) => setSearch(e.target.value)} />
              <div className="product-grid">
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
              {!visibleProducts.length && <Text>Nimikkeitä ei löytynyt.</Text>}
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
            <Button
              className="primary"
              type="submit"
              disabled={!amount || busy}
            >
              {action === "charge" ? "Veloita" : "Lisää saldoa"}
              {amount && /^\d+([.,]\d{1,2})?$/.test(amount)
                ? ` ${formatAmount(Math.round(Number(amount.replace(",", ".")) * 100))}`
                : ""}
            </Button>
          </form>
          {error && (
            <Text role="alert" className="error">
              {error}
            </Text>
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
                  <Text className="entry-label">
                    {entry.reversal_of
                      ? "Hyvitys"
                      : entry.cents < 0
                        ? entry.label
                        : "Saldon lisäys"}
                  </Text>
                  <Text className="entry-date">
                    {new Date(entry.created_at).toLocaleString("fi-FI", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {entry.reversed ? " · Peruttu" : ""}
                  </Text>
                </div>
                <Text className="entry-amount">
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
        <Text className="empty-account">Valitse tai lisää henkilö.</Text>
      )}
      {error && !customer && (
        <Text role="alert" className="error">
          {error}
        </Text>
      )}
    </section>
  );
}
