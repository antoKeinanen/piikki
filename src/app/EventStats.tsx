import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { Ledger } from "../ledger";
import { EventAnalytics } from "../features/analytics/EventAnalytics";
import { compareEvents, summarizeEvent } from "../features/analytics/summary";

export function EventStats({
  ledger,
  revision,
}: {
  ledger: Ledger;
  revision: number;
}) {
  const [chosen, setChosen] = useState<string>();
  const { data } = useQuery({
    // Under "book" so every ledger mutation refreshes the statistics too.
    queryKey: ["book", revision, "stats"],
    queryFn: () => {
      const events = ledger.events();
      const summaries = events.map((event) => summarizeEvent(ledger.snapshot(event.id)));
      return {
        events,
        summaries,
        comparison: compareEvents(events.map((event, i) => ({ event, summary: summaries[i] }))),
      };
    },
    placeholderData: keepPreviousData,
  });
  if (!data) return null;
  const latest = data.events[data.events.length - 1].id;
  const index = Math.max(data.events.findIndex((event) => event.id === (chosen ?? latest)), 0);
  return (
    <EventAnalytics
      events={data.events}
      eventId={data.events[index].id}
      summary={data.summaries[index]}
      comparison={data.comparison}
      onEvent={setChosen}
    />
  );
}
