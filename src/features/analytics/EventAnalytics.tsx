import { NativeSelect, Text } from "@chakra-ui/react";
import { formatAmount, type LedgerEvent } from "../../ledger";
import type { EventComparison as Comparison, EventSummary } from "./summary";
import { EmptyNote, CustomerRanking, ProductRanking } from "./Rankings";
import { CumulativeTotals, SalesOverTime } from "./TimeCharts";
import { EventComparison } from "./EventComparison";
import { PurchaseSizes } from "./PurchaseSizes";

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stat-tile">
      <Text className="stat-label">{label}</Text>
      <Text className="stat-value">{value}</Text>
      <Text className="stat-note-line">{note ?? " "}</Text>
    </div>
  );
}

function Tiles({ summary }: { summary: EventSummary }) {
  const perBuyer = summary.buyers ? summary.purchases / summary.buyers : 0;
  const undoneShare = summary.purchases + summary.undone
    ? Math.round((summary.undone / (summary.purchases + summary.undone)) * 100)
    : 0;
  return (
    <div className="stat-tiles">
      <Tile label="Myynti" value={formatAmount(summary.sales)} />
      <Tile
        label="Ostoja"
        value={String(summary.purchases)}
        note={summary.purchases ? `suurin osto ${formatAmount(summary.largest)}` : undefined}
      />
      <Tile
        label="Keskiosto"
        value={formatAmount(summary.average)}
      />
      <Tile
        label="Ostajia"
        value={String(summary.buyers)}
        note={summary.buyers ? `${perBuyer.toFixed(1).replace(".", ",")} ostoa henkilöä kohti` : undefined}
      />
      <Tile
        label="Saldoa lisätty"
        value={formatAmount(summary.deposits)}
        note={`${summary.depositCount} lisäystä`}
      />
      <Tile label="Saldoa jäljellä" value={formatAmount(summary.held)} />
      <Tile
        label="Velkaa"
        value={formatAmount(summary.debt)}
        note={`${summary.debtors} henkilöä`}
      />
      <Tile
        label="Perutut ostot"
        value={String(summary.undone)}
        note={summary.undone ? `${undoneShare} % kaikista ostoista` : undefined}
      />
    </div>
  );
}

export function EventAnalytics({
  events,
  eventId,
  summary,
  comparison,
  onEvent,
}: {
  events: LedgerEvent[];
  eventId: string;
  summary: EventSummary;
  comparison: Comparison[];
  onEvent(id: string): void;
}) {
  return (
    <main className="stats">
      <div className="stats-filter">
        <h1>Tilastot</h1>
        <NativeSelect.Root size="sm" width="auto" maxWidth="100%">
          <NativeSelect.Field
            aria-label="Tapahtuma"
            value={eventId}
            onChange={(event) => onEvent(event.target.value)}
          >
            {[...events].reverse().map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </div>
      <Tiles summary={summary} />
      <div className="stat-panels">
        {summary.timeline.length > 0 && (
          <>
            <SalesOverTime summary={summary} />
            <CumulativeTotals summary={summary} />
          </>
        )}
        {summary.purchases > 0 ? (
          <>
            <PurchaseSizes summary={summary} />
            <ProductRanking summary={summary} />
            <CustomerRanking summary={summary} />
          </>
        ) : (
          <EmptyNote>Tässä tapahtumassa ei ole vielä myyntiä.</EmptyNote>
        )}
        {comparison.length > 1 && (
          <EventComparison rows={comparison} eventId={eventId} />
        )}
      </div>
      <Text className="stats-note">
        Luvuissa ei ole mukana peruttuja ostoja eikä niiden hyvityksiä. Saldo ja velka ovat
        tilanne valitun tapahtuman lopussa, ja niihin sisältyvät aiemmat tapahtumat.
      </Text>
    </main>
  );
}
