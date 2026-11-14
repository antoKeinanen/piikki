import { Button, Text } from "@chakra-ui/react";
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
  if (!customers.length)
    return (
      <div className="settings-empty">
        <Text className="settings-empty-title">Ei poistettuja henkilöitä.</Text>
        <Text className="settings-empty-text">
          Poistetut henkilöt näkyvät tässä. Heidät voi palauttaa saldoineen.
        </Text>
      </div>
    );
  return (
    <div className="product-list">
      {customers.map((customer) => (
        <div className="product-row" key={customer.id}>
          <span>
            {customer.name}
            {customer.osakunta && ` • ${customer.osakunta}`}
            <small>{formatAmount(customer.balance)}</small>
          </span>
          <Button
            variant="outline"
            className="secondary"
            disabled={busy}
            onClick={() => void restore(customer.id).catch(() => {})}
          >
            Palauta {customer.name}
          </Button>
        </div>
      ))}
    </div>
  );
}
