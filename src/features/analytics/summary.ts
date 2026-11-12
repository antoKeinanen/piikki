import type { Customer, Entry, LedgerEvent } from "../../ledger";

export type ProductSales = { name: string; units: number; cents: number };
export type CustomerSpend = { name: string; purchases: number; cents: number };
export type SizeBand = { label: string; count: number };
export type TimeBucket = {
  start: number;
  sales: number;
  purchases: number;
  deposits: number;
  /** Running totals up to and including this bucket. */
  totalSales: number;
  totalDeposits: number;
};
export type EventSummary = {
  /** Charged cents, excluding undone purchases. */
  sales: number;
  purchases: number;
  buyers: number;
  buyerIds: string[];
  /** Mean purchase in cents. */
  average: number;
  largest: number;
  /** Purchases that were charged and then undone. */
  undone: number;
  /** Deposited cents, excluding undone deposits. */
  deposits: number;
  depositCount: number;
  /** Positive balances still held, and the total owed by negative ones. */
  held: number;
  debt: number;
  debtors: number;
  products: ProductSales[];
  topCustomers: CustomerSpend[];
  sizes: SizeBand[];
  unit: "hour" | "day";
  timeline: TimeBucket[];
};

/** Entries do not reference products, so charges are grouped by their label. */
export const OTHER_PRODUCT = "Muu summa";
// Labels the cashier writes for a charge that was not a product button.
const genericLabels = new Set(["Veloita", "Purchase"]);
// Upper bounds, in cents, of every purchase size band but the last.
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
  const charges = counted.filter((entry) => entry.cents < 0);
  const deposits = counted.filter((entry) => entry.cents > 0);
  const sales = charges.reduce((sum, charge) => sum - charge.cents, 0);

  const products = new Map<string, ProductSales>();
  const spend = new Map<string, CustomerSpend>();
  const names = new Map(customers.map((customer) => [customer.id, customer.name]));
  const sizes = sizeLabels.map((label) => ({ label, count: 0 }));
  for (const charge of charges) {
    const cents = -charge.cents;
    const name = genericLabels.has(charge.label) ? OTHER_PRODUCT : charge.label;
    const product = products.get(name) ?? { name, units: 0, cents: 0 };
    product.units += 1;
    product.cents += cents;
    products.set(name, product);
    const customer = spend.get(charge.customer_id) ?? {
      name: names.get(charge.customer_id) ?? "Tuntematon",
      purchases: 0,
      cents: 0,
    };
    customer.purchases += 1;
    customer.cents += cents;
    spend.set(charge.customer_id, customer);
    const band = sizeLimits.findIndex((limit) => cents < limit);
    sizes[band === -1 ? sizeLimits.length : band].count += 1;
  }

  const times = counted.map((entry) => new Date(entry.created_at).getTime());
  const first = Math.min(...times);
  const last = Math.max(...times);
  const unit = last - first > 48 * HOUR ? "day" : "hour";
  const buckets = new Map<number, Pick<TimeBucket, "sales" | "purchases" | "deposits">>();
  if (counted.length)
    for (let t = floorTo(first, unit); t <= last; t = advance(t, unit))
      buckets.set(t, { sales: 0, purchases: 0, deposits: 0 });
  counted.forEach((entry, index) => {
    const bucket = buckets.get(floorTo(times[index], unit));
    if (!bucket) return;
    if (entry.cents < 0) {
      bucket.sales -= entry.cents;
      bucket.purchases += 1;
    } else bucket.deposits += entry.cents;
  });
  let totalSales = 0;
  let totalDeposits = 0;
  const timeline = [...buckets].map(([start, bucket]) => {
    totalSales += bucket.sales;
    totalDeposits += bucket.deposits;
    return { start, ...bucket, totalSales, totalDeposits };
  });

  return {
    sales,
    purchases: charges.length,
    buyers: spend.size,
    buyerIds: [...spend.keys()],
    average: charges.length ? Math.round(sales / charges.length) : 0,
    largest: charges.reduce((max, charge) => Math.max(max, -charge.cents), 0),
    undone: entries.filter((entry) => entry.reversed && entry.cents < 0).length,
    deposits: deposits.reduce((sum, entry) => sum + entry.cents, 0),
    depositCount: deposits.length,
    held: customers.reduce((sum, customer) => sum + Math.max(customer.balance, 0), 0),
    debt: customers.reduce((sum, customer) => sum - Math.min(customer.balance, 0), 0),
    debtors: customers.filter((customer) => customer.balance < 0).length,
    products: [...products.values()].sort(
      (a, b) => b.cents - a.cents || a.name.localeCompare(b.name, "fi"),
    ),
    topCustomers: [...spend.values()]
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
  sales: number;
  purchases: number;
  buyers: number;
  /** Buyers who also bought at an earlier event. */
  returning: number;
};

/** Events must be ordered from oldest to newest. */
export function compareEvents(
  items: { event: LedgerEvent; summary: EventSummary }[],
): EventComparison[] {
  const seen = new Set<string>();
  return items.map(({ event, summary }) => {
    const returning = summary.buyerIds.filter((id) => seen.has(id)).length;
    summary.buyerIds.forEach((id) => seen.add(id));
    return {
      id: event.id,
      name: event.name,
      sales: summary.sales,
      purchases: summary.purchases,
      buyers: summary.buyers,
      returning,
    };
  });
}
