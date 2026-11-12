import { Chart, useChart } from "@chakra-ui/charts";
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";
import { formatAmount } from "../../ledger";
import type { EventComparison as Row } from "./summary";
import { GRID, PRIMARY, SECONDARY, Section, tickMoney, tooltipMoney } from "./chart-style";

export function EventComparison({ rows, eventId }: { rows: Row[]; eventId: string }) {
  // Newest first, matching the event menu.
  const data = [...rows].reverse();
  const chart = useChart({
    data,
    series: [{ name: "sales", label: "Myynti", color: PRIMARY }],
  });
  return (
    <Section
      wide
      id="event-comparison"
      title="Tapahtumien vertailu"
      hint="Valittu tapahtuma näkyy tummempana."
    >
      <Chart.Root h={`${Math.max(data.length * 44 + 40, 120)}px`} aspectRatio="auto" chart={chart}>
        <BarChart data={chart.data} layout="vertical" responsive>
          <CartesianGrid horizontal={false} {...GRID} />
          <XAxis axisLine={false} tickLine={false} type="number" tickFormatter={tickMoney} />
          <YAxis axisLine={false} tickLine={false} type="category" dataKey="name" width={140} />
          <Tooltip
            cursor={false}
            animationDuration={100}
            content={<Chart.Tooltip nameKey="name" formatter={tooltipMoney} />}
          />
          <Bar
            isAnimationActive={false}
            dataKey={chart.key("sales")}
            maxBarSize={24}
            radius={[0, 4, 4, 0]}
          >
            {data.map((row) => (
              <Cell key={row.id} fill={row.id === eventId ? PRIMARY : SECONDARY} />
            ))}
          </Bar>
        </BarChart>
      </Chart.Root>
      <table className="chart-table-plain">
        <thead>
          <tr>
            <th scope="col">Tapahtuma</th>
            <th scope="col" className="number">Myynti</th>
            <th scope="col" className="number">Ostoja</th>
            <th scope="col" className="number">Ostajia</th>
            <th scope="col" className="number">Palaavia</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id} aria-current={row.id === eventId ? "true" : undefined}>
              <th scope="row">{row.name}</th>
              <td className="number">{formatAmount(row.sales)}</td>
              <td className="number">{row.purchases}</td>
              <td className="number">{row.buyers}</td>
              <td className="number">
                {row.returning}
                {row.buyers ? ` (${Math.round((row.returning / row.buyers) * 100)} %)` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
