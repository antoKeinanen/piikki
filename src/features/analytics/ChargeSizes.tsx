import { Chart, useChart } from "@chakra-ui/charts";
import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from "recharts";
import type { EventSummary } from "./summary";
import { GRID, PRIMARY, Section } from "./chart-style";

export function ChargeSizes({ summary }: { summary: EventSummary }) {
  const chart = useChart({
    data: summary.sizes,
    series: [{ name: "count", label: "Veloituksia", color: PRIMARY }],
  });
  return (
    <Section id="charge-sizes" title="Veloitusten koko" hint="Veloitusten määrä summan mukaan.">
      <Chart.Root h="240px" aspectRatio="auto" chart={chart}>
        <BarChart data={chart.data} responsive>
          <CartesianGrid vertical={false} {...GRID} />
          <XAxis axisLine={false} tickLine={false} dataKey="label" />
          <YAxis axisLine={false} tickLine={false} width={32} allowDecimals={false} />
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
    </Section>
  );
}
