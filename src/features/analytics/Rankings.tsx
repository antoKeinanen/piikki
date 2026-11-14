import { Text } from "@chakra-ui/react";
import { formatAmount } from "../../ledger";
import type { EventSummary } from "./summary";
import { Section, count } from "./chart-style";

function Ranking({
  rows,
  label,
}: {
  rows: { name: string; value: number; detail: string }[];
  label: string;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ol className="ranking" aria-label={label}>
      {rows.map((row, index) => (
        <li key={index}>
          <span className="ranking-label">
            <span className="ranking-name">{row.name}</span>
            <span className="ranking-detail">{row.detail}</span>
          </span>
          <span className="ranking-track" aria-hidden="true">
            <span className="ranking-bar" style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <span className="ranking-value">{formatAmount(row.value)}</span>
        </li>
      ))}
    </ol>
  );
}

export function ProductRanking({ summary }: { summary: EventSummary }) {
  return (
    <Section id="product-charged" title="Nimikkeet" hint="Veloitettu yhteensä nimikkeittäin.">
      <Ranking
        label="Veloitukset nimikkeittäin"
        rows={summary.products.map((product) => ({
          name: product.name,
          value: product.cents,
          detail: `${product.units} kpl`,
        }))}
      />
    </Section>
  );
}

export function CustomerRanking({ summary }: { summary: EventSummary }) {
  return (
    <Section
      id="top-people"
      title="Eniten veloitettu yhteensä"
      hint={`Henkilöt veloitetun summan mukaan${summary.people > 10 ? `, kymmenen ensimmäistä ${summary.people} henkilöstä` : ""}.`}
    >
      <Ranking
        label="Eniten veloitetut henkilöt"
        rows={summary.topCustomers.map((customer) => ({
          name: customer.name,
          value: customer.cents,
          detail: count(customer.charges, "veloitus", "veloitusta"),
        }))}
      />
    </Section>
  );
}

export function EmptyNote({ children }: { children: string }) {
  return <Text className="empty-history">{children}</Text>;
}
