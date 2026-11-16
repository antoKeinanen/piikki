import { BarList, useChart, type BarListData } from "@chakra-ui/charts";
import { Span } from "@chakra-ui/react";
import { formatAmount } from "../../ledger";
import type { EventSummary } from "./summary";
import { Section, TINT } from "./chart-style";

function Ranking({
  rows,
  label,
}: {
  rows: { name: string; value: number; detail: string }[];
  label: string;
}) {
  const details = new Map(rows.map((row) => [row.name, row.detail]));
  const chart = useChart<BarListData>({
    data: rows.map(({ name, value }) => ({ name, value })),
    series: [{ name: "name", color: TINT }],
  });
  return (
    <BarList.Root chart={chart} barSize="9" aria-label={label}>
      <BarList.Content>
        <BarList.Bar
          label={({ payload }) => (
            <Span>
              {payload.name}
              <Span color="fg.muted" ms="2">
                {details.get(payload.name)}
              </Span>
            </Span>
          )}
        />
        <BarList.Value valueFormatter={(value) => formatAmount(value)} minW="16" />
      </BarList.Content>
    </BarList.Root>
  );
}

export function ProductRanking({ summary }: { summary: EventSummary }) {
  return (
    <Section id="product-charged" title="Nimikkeet" hint="Veloitettu summa nimikkeittäin. Kappalemäärä on nimen vieressä.">
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
      title="Eniten veloitetut"
      hint={summary.people > 10 ? `Kärkikymmenen ${summary.people} henkilöstä.` : "Kaikki henkilöt, joilla on veloituksia."}
    >
      <Ranking
        label="Eniten veloitetut henkilöt"
        rows={summary.topCustomers.map((customer) => ({
          name: customer.name,
          value: customer.cents,
          detail: `${customer.charges} veloitusta`,
        }))}
      />
    </Section>
  );
}

export function EmptyNote({ children }: { children: string }) {
  return <p className="empty-text">{children}</p>;
}
