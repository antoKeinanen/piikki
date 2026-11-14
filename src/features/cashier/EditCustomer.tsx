import { Button, Text } from "@chakra-ui/react";
import { formatAmount, type Customer } from "../../ledger";
import { CustomerForm, type KnownPerson } from "./CustomerForm";

export function EditCustomer({
  customer,
  busy,
  save,
  remove,
  osakunnat,
  people,
}: {
  customer: Customer;
  busy: boolean;
  save(name: string, osakunta: string): Promise<void>;
  remove(): Promise<void>;
  osakunnat: string[];
  people: KnownPerson[];
}) {
  return (
    <div className="settings-form">
      <CustomerForm
        busy={busy}
        initial={customer}
        submitLabel="Tallenna muutokset"
        osakunnat={osakunnat}
        people={people}
        selfId={customer.id}
        save={({ name, osakunta }) => save(name, osakunta)}
      />
      <section className="delete-customer" aria-labelledby="delete-customer-title">
        <Text as="h3" id="delete-customer-title" className="delete-customer-title">
          Henkilön poistaminen
        </Text>
        <Text className="delete-customer-note">
          {customer.balance
            ? `Saldo ${formatAmount(customer.balance)} ja tapahtumat säilyvät. `
            : "Tapahtumat säilyvät. "}
          Poistetun henkilön voi palauttaa asetuksista.
        </Text>
        <Button
          variant="outline"
          className="danger-outline"
          disabled={busy}
          onClick={() => void remove().catch(() => {})}
        >
          Poista henkilö
        </Button>
      </section>
    </div>
  );
}
