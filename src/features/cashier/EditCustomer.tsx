import { Button, Text } from "@chakra-ui/react";
import { formatAmount, type Customer } from "../../ledger";
import { CustomerForm } from "./CustomerForm";

export function EditCustomer({
  customer,
  busy,
  save,
  remove,
}: {
  customer: Customer;
  busy: boolean;
  save(name: string, osakunta: string): Promise<void>;
  remove(): Promise<void>;
}) {
  return (
    <div className="settings-form">
      <CustomerForm
        busy={busy}
        initial={customer}
        submitLabel="Tallenna muutokset"
        save={save}
      />
      <div className="delete-customer">
        <Text className="delete-customer-note">
          {customer.balance
            ? `Saldo ${formatAmount(customer.balance)} ja tapahtumat säilyvät. `
            : "Tapahtumat säilyvät. "}
          Poistetun henkilön voi palauttaa asetuksista.
        </Text>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void remove().catch(() => {})}
        >
          Poista henkilö
        </Button>
      </div>
    </div>
  );
}
