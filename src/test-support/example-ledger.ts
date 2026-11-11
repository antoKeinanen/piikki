import { Ledger } from "../ledger";

export async function createExample() {
  const ledger = await Ledger.open();
  for (const [name, reference, balance] of [
    ["Aino Korhonen", "1001", 4250],
    ["Elias Nieminen", "1002", 1800],
    ["Emma Virtanen", "1003", 3200],
    ["Leo Mäkinen", "1004", 750],
    ["Lilja Laine", "1005", 2600],
    ["Noah Heikkinen", "1006", 0],
    ["Olivia Koskinen", "1007", 5500],
    ["Onni Järvinen", "1008", 1200],
    ["Sofia Lehtonen", "1009", 850],
    ["Väinö Salonen", "1010", 3000],
  ] as const) {
    await ledger.addCustomer(name, reference);
    const customer = ledger
      .snapshot()
      .customers.find((c) => c.reference === reference);
    if (customer && balance)
      await ledger.post({
        customerId: customer.id,
        cents: balance,
        label: "Deposit",
        kind: "deposit",
      });
  }
  for (const [name, cents] of [
    ["Kahvi", 250],
    ["Lounas", 850],
    ["Tee", 350],
    ["Mehu", 200],
  ] as const)
    await ledger.saveProduct({ id: crypto.randomUUID(), name, cents, description: "", image: "" });
  return ledger;
}
