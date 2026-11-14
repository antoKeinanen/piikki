import { expect, it } from "vitest";
import type { Entry } from "../../ledger";
import { OTHER_PRODUCT, compareEvents, summarizeEvent } from "./summary";

let next = 0;
function entry(overrides: Partial<Entry>): Entry {
  return {
    id: `e${next++}`,
    customer_id: "a",
    cents: -200,
    label: "Kahvi",
    created_at: "2026-11-12T10:15:00",
    reversal_of: null,
    reversed: 0,
    operator: "",
    note: "",
    opening: 0,
    ...overrides,
  };
}
const customers = [
  { id: "a", name: "Aino", balance: 500 },
  { id: "b", name: "Eino", balance: -300 },
  { id: "c", name: "Venla", balance: 0 },
];
const summarize = (entries: Entry[]) => summarizeEvent({ entries, customers });

it("summarizes an empty event", () => {
  expect(summarize([])).toMatchObject({
    charged: 0,
    charges: 0,
    people: 0,
    average: 0,
    largest: 0,
    deposits: 0,
    products: [],
    topCustomers: [],
    timeline: [],
  });
});

it("counts charges, people and deposits and ignores undone entries", () => {
  const summary = summarize([
    entry({ customer_id: "a", cents: 1000, label: "Lisää saldoa" }),
    entry({ customer_id: "b", cents: 500, label: "Lisää saldoa", reversed: 1 }),
    entry({ customer_id: "b", cents: -500, label: "Undo Lisää saldoa", reversal_of: "x" }),
    entry({ customer_id: "a", cents: -250 }),
    entry({ customer_id: "a", cents: -250 }),
    entry({ customer_id: "b", cents: -850, label: "Lounas" }),
    entry({ customer_id: "c", cents: -350, label: "Tee", reversed: 1 }),
    entry({ customer_id: "c", cents: 350, label: "Undo Tee", reversal_of: "y" }),
  ]);
  expect(summary).toMatchObject({
    charged: 1350,
    charges: 3,
    people: 2,
    average: 450,
    largest: 850,
    undone: 1,
    deposits: 1000,
    depositCount: 1,
  });
  expect(summary.products).toEqual([
    { name: "Lounas", units: 1, cents: 850 },
    { name: "Kahvi", units: 2, cents: 500 },
  ]);
});

it("splits balances into money held and money owed", () => {
  expect(summarize([])).toMatchObject({ held: 500, debt: 300, debtors: 1 });
});

it("groups charges without a product under one name", () => {
  const summary = summarize([
    entry({ label: "Veloita", cents: -100 }),
    entry({ label: "Purchase", cents: -300 }),
  ]);
  expect(summary.products).toEqual([{ name: OTHER_PRODUCT, units: 2, cents: 400 }]);
});

it("ranks people by charged total and names unknown people", () => {
  const summary = summarize([
    entry({ customer_id: "a", cents: -100 }),
    entry({ customer_id: "b", cents: -900 }),
    entry({ customer_id: "b", cents: -100 }),
    entry({ customer_id: "gone", cents: -400 }),
  ]);
  expect(summary.topCustomers).toEqual([
    { name: "Eino", charges: 2, cents: 1000 },
    { name: "Tuntematon", charges: 1, cents: 400 },
    { name: "Aino", charges: 1, cents: 100 },
  ]);
});

it("sorts charges into size bands", () => {
  const summary = summarize(
    [150, 199, 200, 499, 500, 999, 1000, 1999, 2000, 5000].map((cents) => entry({ cents: -cents })),
  );
  expect(summary.sizes.map((band) => band.count)).toEqual([2, 2, 2, 2, 2]);
  expect(summary.sizes.map((band) => band.label)).toEqual(["alle 2", "2–4,99", "5–9,99", "10–19,99", "20 tai yli"]);
});

it("buckets by hour, filling quiet hours and keeping running totals", () => {
  const summary = summarize([
    entry({ created_at: "2026-11-12T17:50:00", cents: 1000, label: "Lisää saldoa" }),
    entry({ created_at: "2026-11-12T18:05:00", cents: -100 }),
    entry({ created_at: "2026-11-12T18:50:00", cents: -200 }),
    entry({ created_at: "2026-11-12T20:00:00", cents: -400 }),
  ]);
  expect(summary.unit).toBe("hour");
  expect(summary.timeline.map((bucket) => bucket.charged)).toEqual([0, 300, 0, 400]);
  expect(summary.timeline.map((bucket) => bucket.deposits)).toEqual([1000, 0, 0, 0]);
  expect(summary.timeline.map((bucket) => bucket.charges)).toEqual([0, 2, 0, 1]);
  expect(summary.timeline.map((bucket) => bucket.totalCharged)).toEqual([0, 300, 300, 700]);
  expect(summary.timeline.at(-1)).toMatchObject({ totalCharged: summary.charged, totalDeposits: 1000 });
});

it("switches to daily buckets for events longer than two days", () => {
  const summary = summarize([
    entry({ created_at: "2026-11-10T12:00:00", cents: -100 }),
    entry({ created_at: "2026-11-14T12:00:00", cents: -200 }),
  ]);
  expect(summary.unit).toBe("day");
  expect(summary.timeline.map((bucket) => bucket.charged)).toEqual([100, 0, 0, 0, 200]);
});

it("compares events and counts people who came back", () => {
  const event = (id: string) => ({ id, name: id });
  const people = (...ids: string[]) =>
    summarize(ids.map((customer_id) => entry({ customer_id, cents: -100 })));
  expect(
    compareEvents([
      { event: event("one"), summary: people("a", "b") },
      { event: event("two"), summary: people("b", "c", "c") },
      { event: event("three"), summary: people("a", "c") },
    ]).map(({ id, charged, charges, people, returning }) => [id, charged, charges, people, returning]),
  ).toEqual([
    ["one", 200, 2, 2, 0],
    ["two", 300, 3, 2, 1],
    ["three", 200, 2, 2, 2],
  ]);
});

it("leaves opening balances out of sales and deposits", () => {
  const summary = summarize([
    entry({ cents: -400, label: "Alkusaldo", opening: 1 }),
    entry({ customer_id: "b", cents: 900, label: "Alkusaldo", opening: 1 }),
    entry({ cents: -250, label: "Kahvi" }),
  ]);
  expect(summary).toMatchObject({ charged: 250, charges: 1, deposits: 0, depositCount: 0 });
  expect(summary.products).toEqual([{ name: "Kahvi", units: 1, cents: 250 }]);
});
