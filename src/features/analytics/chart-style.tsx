import type { ReactNode } from "react";
import { Chart } from "@chakra-ui/charts";
import { Text } from "@chakra-ui/react";
import { formatAmount } from "../../ledger";
import type { EventSummary } from "./summary";

// Chart colors come from the branding CSS variables, so charts match the organisation's theme.
export const PRIMARY = "var(--indicator)";
export const SECONDARY = "color-mix(in srgb, var(--indicator) 55%, var(--accent))";
// Light enough for text to sit on top of it.
export const TINT = "color-mix(in srgb, var(--indicator) 30%, var(--accent))";
export const GRID = { stroke: "var(--line)", strokeOpacity: 0.5 };

export const tickMoney = (cents: number) => formatAmount(cents).replace(/,00$/, "");
export const tooltipMoney = (value: unknown) => formatAmount(Number(value));

export function bucketLabels(timeline: EventSummary["timeline"], unit: EventSummary["unit"]) {
  const days = new Set(timeline.map((bucket) => new Date(bucket.start).toDateString()));
  return timeline.map((bucket) => {
    const date = new Date(bucket.start);
    const day = `${date.getDate()}.${date.getMonth() + 1}.`;
    const hour = String(date.getHours()).padStart(2, "0");
    return {
      tick: unit === "day" ? day : days.size > 1 ? `${day} ${hour}` : `${hour}:00`,
      label: date.toLocaleString(
        "fi-FI",
        unit === "hour"
          ? { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit" }
          : { weekday: "short", day: "numeric", month: "numeric" },
      ),
    };
  });
}

export function ChartTooltip() {
  return <Chart.Tooltip nameKey="label" formatter={tooltipMoney} />;
}

export function Section({
  id,
  title,
  hint,
  wide,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`stat-section ${wide ? "stat-wide" : ""}`} aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {hint && <Text className="stat-hint">{hint}</Text>}
      {children}
    </section>
  );
}
