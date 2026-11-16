import { useState } from "react";
import { formatAmount, type Customer } from "../../ledger";

export function RemovedCustomers({
  customers,
  busy,
  restore,
}: {
  customers: Customer[];
  busy: boolean;
  restore(id: string): Promise<void>;
}) {
  const [restored, setRestored] = useState("");
  return (
    <>
      {restored && (
        <p className="inline-notice" role="status">
          {restored} palautettu listalle.
        </p>
      )}
      {!customers.length && <p className="empty-text">Ei poistettuja henkilöitä.</p>}
      <ul className="rows">
        {customers.map((customer) => (
          <li className="row" key={customer.id}>
            <span className="row-main">
              <span className="row-title">{customer.name}</span>
              <span className="row-detail">
                {customer.osakunta && `${customer.osakunta} · `}Saldo {formatAmount(customer.balance)}
              </span>
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => void restore(customer.id).then(() => setRestored(customer.name), () => {})}
            >
              Palauta {customer.name}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
