import type { ReactNode } from "react";
import { NativeSelect, Text } from "@chakra-ui/react";
import { formatAmount, type LedgerEvent } from "../../ledger";
import type { EventComparison as Comparison, EventSummary } from "./summary";
import { EmptyNote, CustomerRanking, ProductRanking } from "./Rankings";
import { CumulativeTotals, ChargesOverTime } from "./TimeCharts";
import { EventComparison } from "./EventComparison";
import { ChargeSizes } from "./ChargeSizes";
import { count } from "./chart-style";

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stat-tile">
      <Text className="stat-label">{label}</Text>
      <Text className="stat-value">{value}</Text>
      <Text className="stat-note-line">{note ?? " "}</Text>
    </div>
  );
}

function TileGroup({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <section className={`stat-group stat-group-${id}`} aria-labelledby={`scope-${id}`}>
      <h2 id={`scope-${id}`} className="stat-scope">
        {label}
      </h2>
      {children}
    </section>
  );
}

function Tiles({ summary }: { summary: EventSummary }) {
  const perPerson = summary.people ? summary.charges / summary.people : 0;
  const undoneShare = summary.charges + summary.undone
    ? Math.round((summary.undone / (summary.charges + summary.undone)) * 100)
    : 0;
  return (
    <div className="stat-tiles">
      <TileGroup id="event" label="Tässä tapahtumassa">
        <Tile label="Veloitettu" value={formatAmount(summary.charged)} />
        <Tile
          label="Veloituksia"
          value={String(summary.charges)}
          note={summary.charges ? `suurin veloitus ${formatAmount(summary.largest)}` : undefined}
        />
        <Tile label="Keskiveloitus" value={formatAmount(summary.average)} />
        <Tile
          label="Henkilöitä"
          value={String(summary.people)}
          note={summary.people ? `${perPerson.toFixed(1).replace(".", ",")} veloitusta henkilöä kohti` : undefined}
        />
        <Tile
          label="Saldoa lisätty"
          value={formatAmount(summary.deposits)}
          note={count(summary.depositCount, "lisäys", "lisäystä")}
        />
        <Tile
          label="Perutut veloitukset"
          value={String(summary.undone)}
          note={summary.undone ? `${undoneShare} % kaikista veloituksista` : undefined}
        />
      </TileGroup>
      <TileGroup id="balances" label="Saldot tapahtuman lopussa">
        <Tile label="Saldoa jäljellä" value={formatAmount(summary.held)} note="kaikki tilit yhteensä" />
        <Tile
          label="Velkaa"
          value={formatAmount(summary.debt)}
          note={count(summary.debtors, "henkilö", "henkilöä")}
        />
      </TileGroup>
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
        Peruttuja veloituksia ja niiden hyvityksiä ei lasketa mukaan. Alkusaldot näkyvät vain
        saldoissa ja velassa.
      </Text>
    </main>
  );
}
