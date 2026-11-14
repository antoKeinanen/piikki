import { Chart, useChart } from "@chakra-ui/charts";
import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from "recharts";
import type { EventSummary } from "./summary";
import { GRID, PRIMARY, Section } from "./chart-style";

// The band labels are HTML below the plot so long labels wrap on narrow screens.
// These offsets line its columns up with the bars.
const Y_AXIS = 32;
const RIGHT = 4;

export function ChargeSizes({ summary }: { summary: EventSummary }) {
  const chart = useChart({
    data: summary.sizes,
    series: [{ name: "count", label: "Veloituksia", color: PRIMARY }],
  });
  return (
    <Section id="charge-sizes" title="Veloitusten koko" hint="Veloitusten määrä summan mukaan.">
      <Chart.Root h="200px" aspectRatio="auto" chart={chart}>
        <BarChart data={chart.data} margin={{ top: 20, right: RIGHT, left: 0, bottom: 10 }} responsive>
          <CartesianGrid vertical={false} {...GRID} />
          <XAxis dataKey="label" hide />
          <YAxis axisLine={false} tickLine={false} width={Y_AXIS} allowDecimals={false} />
          <Tooltip
            cursor={false}
            animationDuration={100}
            content={<Chart.Tooltip nameKey="label" />}
          />
          <Bar
            isAnimationActive={false}
            dataKey={chart.key("count")}
            fill={chart.color(PRIMARY)}
            maxBarSize={24}
            radius={[4, 4, 0, 0]}
          >
            <LabelList dataKey="count" position="top" className="chart-value" />
          </Bar>
        </BarChart>
      </Chart.Root>
      <div className="size-axis" style={{ paddingLeft: Y_AXIS, paddingRight: RIGHT }}>
        <ol className="size-ticks">
          {summary.sizes.map((band) => (
            <li key={band.label}>{band.label}</li>
          ))}
        </ol>
        <p className="chart-caption">Veloituksen summa</p>
      </div>
    </Section>
  );
}
