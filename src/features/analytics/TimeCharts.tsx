import { Chart, useChart } from "@chakra-ui/charts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
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
// Beyond this many bars the value labels would collide; the tooltip and table remain.
const MAX_LABELED_BARS = 24;

function BucketTable({ summary, rows }: { summary: EventSummary; rows: ReturnType<typeof timeRows> }) {
  return (
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
          {rows.map((row) => (
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
  );
}

const title = (summary: EventSummary) =>
  summary.unit === "hour" ? "Veloitukset tunneittain" : "Veloitukset päivittäin";

export function TimeCharts({ summary }: { summary: EventSummary }) {
  if (summary.timeline.length === 0) return null;
  if (summary.timeline.length === 1) return <SingleBucket summary={summary} />;
  return (
    <>
      <ChargesOverTime summary={summary} />
      <CumulativeTotals summary={summary} />
    </>
  );
}

// One bucket would leave a mostly empty plot, and its totals equal the cumulative ones,
// so a single card with the totals replaces both charts.
function SingleBucket({ summary }: { summary: EventSummary }) {
  const data = timeRows(summary);
  const [row] = data;
  return (
    <Section
      id="charged-over-time"
      title={title(summary)}
      hint={`Kaikki kirjaukset ovat ${summary.unit === "hour" ? "samalta tunnilta" : "samalta päivältä"} (${row.label}).`}
    >
      <SeriesKey values={row} large />
      <BucketTable summary={summary} rows={data} />
    </Section>
  );
}

function ChargesOverTime({ summary }: { summary: EventSummary }) {
  const data = timeRows(summary);
  const chart = useChart({
    data,
    series: [{ name: "charged", label: "Veloitettu", color: PRIMARY }],
  });
  return (
    <Section
      wide
      id="charged-over-time"
      title={title(summary)}
      hint="Saldon lisäykset näkyvät kertyvissä summissa ja taulukossa."
    >
      <Chart.Root h="200px" aspectRatio="auto" chart={chart}>
        <BarChart data={chart.data} margin={{ top: 22, right: 4, left: 0, bottom: 0 }} responsive>
          <CartesianGrid vertical={false} {...GRID} />
          <XAxis {...axis} dataKey="tick" interval="preserveStartEnd" minTickGap={12} />
          <YAxis {...axis} width={48} tickFormatter={tickMoney} />
          <Tooltip cursor={false} animationDuration={100} content={<ChartTooltip />} />
          <Bar
            isAnimationActive={false}
            dataKey={chart.key("charged")}
            fill={chart.color(PRIMARY)}
            maxBarSize={32}
            radius={[4, 4, 0, 0]}
          >
            {data.length <= MAX_LABELED_BARS && (
              <LabelList
                dataKey="charged"
                position="top"
                className="chart-value"
                formatter={(value) => (Number(value) ? formatAmount(Number(value)) : "")}
              />
            )}
          </Bar>
        </BarChart>
      </Chart.Root>
      <BucketTable summary={summary} rows={data} />
    </Section>
  );
}

type Shape = "circle" | "square";
const totals = [
  { name: "totalCharged", label: "Veloitettu", color: PRIMARY, shape: "circle", dash: undefined },
  { name: "totalDeposits", label: "Saldoa lisätty", color: SECONDARY, shape: "square", dash: "5 4" },
] as const;

function Marker({ shape, color, x, y }: { shape: Shape; color: string; x: number; y: number }) {
  const style = { fill: color, stroke: "var(--surface)", strokeWidth: 1.5 };
  return shape === "circle" ? (
    <circle cx={x} cy={y} r={4.5} style={style} />
  ) : (
    <rect x={x - 4} y={y - 4} width={8} height={8} style={style} />
  );
}

function SeriesKey({
  values,
  large,
}: {
  values: Record<(typeof totals)[number]["name"], number>;
  large?: boolean;
}) {
  return (
    <ul className={`series-key ${large ? "series-key-large" : ""}`}>
      {totals.map((series) => (
        <li key={series.name}>
          <svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true">
            <line
              x1="0"
              y1="6"
              x2="24"
              y2="6"
              style={{ stroke: series.color, strokeWidth: 2, strokeDasharray: series.dash }}
            />
            <Marker shape={series.shape} color={series.color} x={12} y={6} />
          </svg>
          <span className="series-name">{series.label}</span>
          <span className="series-value">{formatAmount(values[series.name])}</span>
        </li>
      ))}
    </ul>
  );
}

function CumulativeTotals({ summary }: { summary: EventSummary }) {
  const data = timeRows(summary);
  const chart = useChart({
    data,
    series: totals.map(({ name, label, color }) => ({ name, label, color })),
  });
  const last = data[data.length - 1];
  return (
    <Section
      id="cumulative"
      title="Kertyvät summat"
      hint="Veloitukset ja saldon lisäykset yhteensä tapahtuman aikana. Alkusaldot eivät ole mukana."
    >
      <SeriesKey values={last} />
      <Chart.Root h="220px" aspectRatio="auto" chart={chart}>
        <LineChart data={chart.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} responsive>
          <CartesianGrid vertical={false} {...GRID} />
          <XAxis
            {...axis}
            dataKey="tick"
            interval="preserveStartEnd"
            minTickGap={12}
            padding={{ left: 12, right: 12 }}
          />
          <YAxis {...axis} width={48} tickFormatter={tickMoney} />
          <Tooltip cursor={false} animationDuration={100} content={<ChartTooltip />} />
          {totals.map((series) => (
            <Line
              key={series.name}
              isAnimationActive={false}
              type="monotone"
              dataKey={chart.key(series.name)}
              stroke={chart.color(series.color)}
              strokeWidth={2}
              strokeDasharray={series.dash}
              // Mark only the line ends, with the same shapes as the key above.
              dot={({ cx, cy, index }) =>
                index === data.length - 1 ? (
                  <Marker key={index} shape={series.shape} color={series.color} x={cx ?? 0} y={cy ?? 0} />
                ) : (
                  <g key={index} />
                )
              }
              activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </Chart.Root>
    </Section>
  );
}
