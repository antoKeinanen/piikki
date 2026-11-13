import { NativeSelect, Text } from "@chakra-ui/react";
import { formatAmount, type LedgerEvent } from "../../ledger";
import type { EventComparison as Comparison, EventSummary } from "./summary";
import { EmptyNote, CustomerRanking, ProductRanking } from "./Rankings";
import { CumulativeTotals, ChargesOverTime } from "./TimeCharts";
import { EventComparison } from "./EventComparison";
import { ChargeSizes } from "./ChargeSizes";

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
  const perPerson = summary.people ? summary.charges / summary.people : 0;
  const undoneShare = summary.charges + summary.undone
    ? Math.round((summary.undone / (summary.charges + summary.undone)) * 100)
    : 0;
  return (
    <div className="stat-tiles">
      <Tile label="Veloitettu" value={formatAmount(summary.charged)} />
      <Tile
        label="Veloituksia"
        value={String(summary.charges)}
        note={summary.charges ? `suurin veloitus ${formatAmount(summary.largest)}` : undefined}
      />
      <Tile
        label="Keskiveloitus"
        value={formatAmount(summary.average)}
      />
      <Tile
        label="Henkilöitä"
        value={String(summary.people)}
        note={summary.people ? `${perPerson.toFixed(1).replace(".", ",")} veloitusta henkilöä kohti` : undefined}
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
        label="Perutut veloitukset"
        value={String(summary.undone)}
        note={summary.undone ? `${undoneShare} % kaikista veloituksista` : undefined}
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
            <ChargesOverTime summary={summary} />
            <CumulativeTotals summary={summary} />
          </>
        )}
        {summary.charges > 0 ? (
          <>
            <ChargeSizes summary={summary} />
            <ProductRanking summary={summary} />
            <CustomerRanking summary={summary} />
          </>
        ) : (
          <EmptyNote>Tässä tapahtumassa ei ole vielä veloituksia.</EmptyNote>
        )}
        {comparison.length > 1 && (
          <EventComparison rows={comparison} eventId={eventId} />
        )}
      </div>
      <Text className="stats-note">
        Luvuissa ei ole mukana peruttuja veloituksia eikä niiden hyvityksiä. Saldo ja velka ovat
        tilanne valitun tapahtuman lopussa, ja niihin sisältyvät aiemmat tapahtumat.
      </Text>
    </main>
  );
}
