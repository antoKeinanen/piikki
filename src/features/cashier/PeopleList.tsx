import { useState } from "react";
import { type Customer, formatAmount } from "../../ledger";

type Order = "recent" | "name" | "balance";
const ORDERS: { id: Order; label: string }[] = [
  { id: "recent", label: "Viimeisimmät" },
  { id: "name", label: "A–Ö" },
  { id: "balance", label: "Pienin saldo" },
];

function sort(customers: Customer[], order: Order) {
  const byName = (a: Customer, b: Customer) => a.name.localeCompare(b.name, "fi");
  return [...customers].sort((a, b) =>
    order === "name"
      ? byName(a, b)
      : order === "balance"
        ? a.balance - b.balance || byName(a, b)
        : // ISO timestamps sort as text. People without entries come last.
          (b.last_activity ?? "").localeCompare(a.last_activity ?? "") || byName(a, b),
  );
}

export function PeopleList({
  customers,
  selected,
  select,
  add,
  disabled,
}: {
  customers: Customer[];
  selected?: string;
  select(id: string): void;
  /** Opens the add form, with the searched name filled in when there is one. */
  add(name: string): void;
  disabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<Order>("recent");
  const query = search.trim().toLocaleLowerCase("fi");
  // Picking someone clears the search, so the next name can be typed straight away.
  function pick(id: string) {
    select(id);
    setSearch("");
  }
  const rows = sort(
    customers.filter((c) => `${c.name} ${c.osakunta}`.toLocaleLowerCase("fi").includes(query)),
    order,
  );
  return (
    <section className="people" aria-label="Henkilöt">
      <div className="people-search">
        <input
          type="search"
          className="input input-lg"
          aria-label="Hae henkilöä"
          placeholder="Hae henkilöä"
          autoComplete="off"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            // Enter picks the top match, Escape clears the search.
            if (e.key === "Enter" && query && rows[0] && !disabled) pick(rows[0].id);
            if (e.key === "Escape") setSearch("");
          }}
        />
        <button type="button" className="btn btn-secondary" disabled={disabled} onClick={() => add("")}>
          + Lisää henkilö
        </button>
      </div>
      <div className="segmented" role="group" aria-label="Järjestys">
        {ORDERS.map(({ id, label }) => (
          <button
            type="button"
            key={id}
            aria-pressed={order === id}
            onClick={() => setOrder(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="people-list">
        {rows.map((person) => (
          <li key={person.id}>
            <button
              type="button"
              className="person"
              aria-label={`${person.name}${person.osakunta ? `, ${person.osakunta}` : ""}, saldo ${formatAmount(person.balance)}`}
              aria-pressed={person.id === selected}
              disabled={disabled}
              onClick={() => pick(person.id)}
            >
              <span className="person-name">{person.name}</span>
              {person.osakunta && <span className="person-osakunta">{person.osakunta}</span>}
              <span className={`person-balance ${person.balance < 0 ? "negative" : ""}`}>
                {formatAmount(person.balance)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!rows.length && (
        <div className="people-empty">
          {query ? (
            <>
              <p className="empty-text">Ei ketään haulla "{search.trim()}".</p>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={disabled}
                onClick={() => add(search.trim())}
              >
                Lisää {search.trim()}
              </button>
            </>
          ) : (
            <p className="empty-text">Lista on tyhjä. Lisää ensimmäinen henkilö.</p>
          )}
        </div>
      )}
    </section>
  );
}
