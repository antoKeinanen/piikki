import { formatAmount, type Customer } from "../../ledger";
import { CustomerForm, type CustomerValues, type KnownPerson } from "./CustomerForm";

export function EditCustomer({
  customer,
  busy,
  save,
  remove,
  cancel,
  osakunnat,
  people,
}: {
  customer: Customer;
  busy: boolean;
  save(values: CustomerValues): Promise<void>;
  remove(): Promise<void>;
  cancel(): void;
  osakunnat: string[];
  people: KnownPerson[];
}) {
  return (
    <CustomerForm
      busy={busy}
      initial={customer}
      submitLabel="Tallenna"
      osakunnat={osakunnat}
      people={people}
      selfId={customer.id}
      withNote
      save={save}
      cancel={cancel}
    >
      <div className="danger-zone">
        <div>
          <p className="danger-title">Poista henkilö</p>
          <p className="field-hint">
            {customer.balance ? `Saldo ${formatAmount(customer.balance)} ja tapahtumat säilyvät.` : "Tapahtumat säilyvät."}{" "}
            Voit palauttaa henkilön asetuksista.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          disabled={busy}
          onClick={() => void remove().catch(() => {})}
        >
          Poista
        </button>
      </div>
    </CustomerForm>
  );
}
