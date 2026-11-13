import { Chart, useChart } from "@chakra-ui/charts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAmount } from "../../ledger";
import type { EventSummary } from "./summary";
import {
  ChartTooltip,
  GRID,
  PRIMARY,
  SECONDARY,
  Section,
  bucketLabels,
  tickMoney,
} from "./chart-style";

function timeRows(summary: EventSummary) {
  const labels = bucketLabels(summary.timeline, summary.unit);
  return summary.timeline.map((bucket, index) => ({
    ...labels[index],
    charged: bucket.charged,
    deposits: bucket.deposits,
    charges: bucket.charges,
    totalCharged: bucket.totalCharged,
    totalDeposits: bucket.totalDeposits,
  }));
}

const axis = { axisLine: false, tickLine: false } as const;

export function ChargesOverTime({ summary }: { summary: EventSummary }) {
  const data = timeRows(summary);
  const chart = useChart({
    data,
    series: [{ name: "charged", label: "Veloitettu", color: PRIMARY }],
  });
  return (
    <Section
      wide
      id="charged-over-time"
      title={summary.unit === "hour" ? "Veloitukset tunneittain" : "Veloitukset päivittäin"}
      hint="Saldon lisäykset näkyvät kertyvissä summissa ja taulukossa."
    >
      <Chart.Root h="260px" aspectRatio="auto" chart={chart}>
        <BarChart data={chart.data} responsive>
          <CartesianGrid vertical={false} {...GRID} />
          <XAxis {...axis} dataKey="tick" interval="preserveStartEnd" minTickGap={12} />
          <YAxis {...axis} width={44} tickFormatter={tickMoney} />
          <Tooltip cursor={false} animationDuration={100} content={<ChartTooltip />} />
          <Bar
            isAnimationActive={false}
            dataKey={chart.key("charged")}
            fill={chart.color(PRIMARY)}
            maxBarSize={24}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </Chart.Root>
      <details className="chart-table">
        <summary>Näytä taulukkona</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{summary.unit === "hour" ? "Tunti" : "Päivä"}</th>
              <th scope="col" className="number">Veloituksia</th>
              <th scope="col" className="number">Veloitettu</th>
              <th scope="col" className="number">Saldoa lisätty</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td className="number">{row.charges}</td>
                <td className="number">{formatAmount(row.charged)}</td>
                <td className="number">{formatAmount(row.deposits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Section>
  );
}

export function CumulativeTotals({ summary }: { summary: EventSummary }) {
  const data = timeRows(summary);
  const chart = useChart({
    data,
    series: [
      { name: "totalCharged", label: "Veloitettu yhteensä", color: PRIMARY },
      { name: "totalDeposits", label: "Lisätty yhteensä", color: SECONDARY },
    ],
  });
  return (
    <Section
      id="cumulative"
      title="Kertyvät summat"
      hint="Viivojen väli on käyttämättä jäänyt saldo."
    >
      <Chart.Root h="240px" aspectRatio="auto" chart={chart}>
        <LineChart data={chart.data} responsive>
          <CartesianGrid vertical={false} {...GRID} />
          <XAxis {...axis} dataKey="tick" interval="preserveStartEnd" minTickGap={12} />
          <YAxis {...axis} width={44} tickFormatter={tickMoney} />
          <Legend verticalAlign="top" align="left" content={<Chart.Legend />} />
          <Tooltip cursor={false} animationDuration={100} content={<ChartTooltip />} />
          {chart.series.map((item) => (
            <Line
              key={item.name}
              isAnimationActive={false}
              type="monotone"
              dataKey={chart.key(item.name)}
              stroke={chart.color(item.color)}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: "var(--accent)", strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </Chart.Root>
    </Section>
  );
}
