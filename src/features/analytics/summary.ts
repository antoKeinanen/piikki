import type { Customer, Entry, LedgerEvent } from "../../ledger";

export type ItemTotal = { name: string; units: number; cents: number };
export type PersonTotal = { name: string; charges: number; cents: number };
export type SizeBand = { label: string; count: number };
export type TimeBucket = {
  start: number;
  charged: number;
  charges: number;
  deposits: number;
  /** Running totals up to and including this bucket. */
  totalCharged: number;
  totalDeposits: number;
};
export type EventSummary = {
  /** Charged cents, excluding undone charges. */
  charged: number;
  charges: number;
  people: number;
  personIds: string[];
  /** Mean charge in cents. */
  average: number;
  largest: number;
  /** Charges that were later undone. */
  undone: number;
  /** Deposited cents, excluding undone deposits. */
  deposits: number;
  depositCount: number;
  /** Positive balances still held, and the total owed by negative ones. */
  held: number;
  debt: number;
  debtors: number;
  products: ItemTotal[];
  topCustomers: PersonTotal[];
  sizes: SizeBand[];
  unit: "hour" | "day";
  timeline: TimeBucket[];
};

/** Entries do not reference products, so charges are grouped by their label. */
export const OTHER_PRODUCT = "Muu summa";
// Labels the cashier writes for a charge that was not a product button.
// "Purchase" is the legacy default label stored by older versions.
const genericLabels = new Set(["Veloita", "Charge", "Purchase"]);
// Upper bounds, in cents, of every charge size band but the last.
const sizeLimits = [200, 500, 1000, 2000];
const sizeLabels = ["alle 2", "2–5", "5–10", "10–20", "yli 20"];
const TOP_CUSTOMERS = 10;
const HOUR = 3_600_000;

function floorTo(time: number, unit: "hour" | "day") {
  const date = new Date(time);
  if (unit === "hour") date.setMinutes(0, 0, 0);
  else date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function advance(time: number, unit: "hour" | "day") {
  const date = new Date(time);
  if (unit === "hour") date.setHours(date.getHours() + 1);
  else date.setDate(date.getDate() + 1);
  // Guarantees progress across daylight-saving changes.
  return Math.max(date.getTime(), time + HOUR);
}

export function summarizeEvent({
  entries,
  customers,
}: {
  entries: Entry[];
  customers: Pick<Customer, "id" | "name" | "balance">[];
}): EventSummary {
  // An undone entry and its reversal cancel out, so neither is counted.
  const counted = entries.filter((entry) => !entry.reversed && !entry.reversal_of);
  const chargeEntries = counted.filter((entry) => entry.cents < 0);
  const deposits = counted.filter((entry) => entry.cents > 0);
  const charged = chargeEntries.reduce((sum, charge) => sum - charge.cents, 0);

  const products = new Map<string, ItemTotal>();
  const totals = new Map<string, PersonTotal>();
  const names = new Map(customers.map((customer) => [customer.id, customer.name]));
  const sizes = sizeLabels.map((label) => ({ label, count: 0 }));
  for (const charge of chargeEntries) {
    const cents = -charge.cents;
    const name = genericLabels.has(charge.label) ? OTHER_PRODUCT : charge.label;
    const product = products.get(name) ?? { name, units: 0, cents: 0 };
    product.units += 1;
    product.cents += cents;
    products.set(name, product);
    const customer = totals.get(charge.customer_id) ?? {
      name: names.get(charge.customer_id) ?? "Tuntematon",
      charges: 0,
      cents: 0,
    };
    customer.charges += 1;
    customer.cents += cents;
    totals.set(charge.customer_id, customer);
    const band = sizeLimits.findIndex((limit) => cents < limit);
    sizes[band === -1 ? sizeLimits.length : band].count += 1;
  }

  const times = counted.map((entry) => new Date(entry.created_at).getTime());
  const first = Math.min(...times);
  const last = Math.max(...times);
  const unit = last - first > 48 * HOUR ? "day" : "hour";
  const buckets = new Map<number, Pick<TimeBucket, "charged" | "charges" | "deposits">>();
  if (counted.length)
    for (let t = floorTo(first, unit); t <= last; t = advance(t, unit))
      buckets.set(t, { charged: 0, charges: 0, deposits: 0 });
  counted.forEach((entry, index) => {
    const bucket = buckets.get(floorTo(times[index], unit));
    if (!bucket) return;
    if (entry.cents < 0) {
      bucket.charged -= entry.cents;
      bucket.charges += 1;
    } else bucket.deposits += entry.cents;
  });
  let totalCharged = 0;
  let totalDeposits = 0;
  const timeline = [...buckets].map(([start, bucket]) => {
    totalCharged += bucket.charged;
    totalDeposits += bucket.deposits;
    return { start, ...bucket, totalCharged, totalDeposits };
  });

  return {
    charged,
    charges: chargeEntries.length,
    people: totals.size,
    personIds: [...totals.keys()],
    average: chargeEntries.length ? Math.round(charged / chargeEntries.length) : 0,
    largest: chargeEntries.reduce((max, charge) => Math.max(max, -charge.cents), 0),
    undone: entries.filter((entry) => entry.reversed && entry.cents < 0).length,
    deposits: deposits.reduce((sum, entry) => sum + entry.cents, 0),
    depositCount: deposits.length,
    held: customers.reduce((sum, customer) => sum + Math.max(customer.balance, 0), 0),
    debt: customers.reduce((sum, customer) => sum - Math.min(customer.balance, 0), 0),
    debtors: customers.filter((customer) => customer.balance < 0).length,
    products: [...products.values()].sort(
      (a, b) => b.cents - a.cents || a.name.localeCompare(b.name, "fi"),
    ),
    topCustomers: [...totals.values()]
      .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name, "fi"))
      .slice(0, TOP_CUSTOMERS),
    sizes,
    unit,
    timeline,
  };
}

export type EventComparison = {
  id: string;
  name: string;
  charged: number;
  charges: number;
  people: number;
  /** People who were also charged at an earlier event. */
  returning: number;
};

/** Events must be ordered from oldest to newest. */
export function compareEvents(
  items: { event: LedgerEvent; summary: EventSummary }[],
): EventComparison[] {
  const seen = new Set<string>();
  return items.map(({ event, summary }) => {
    const returning = summary.personIds.filter((id) => seen.has(id)).length;
    summary.personIds.forEach((id) => seen.add(id));
    return {
      id: event.id,
      name: event.name,
      charged: summary.charged,
      charges: summary.charges,
      people: summary.people,
      returning,
    };
  });
}
