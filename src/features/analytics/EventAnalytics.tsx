import { formatAmount, type LedgerEvent } from "../../ledger";
import type { EventComparison as Comparison, EventSummary } from "./summary";
import { EmptyNote, CustomerRanking, ProductRanking } from "./Rankings";
import { CumulativeTotals, ChargesOverTime } from "./TimeCharts";
import { EventComparison } from "./EventComparison";
import { ChargeSizes } from "./ChargeSizes";

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stat-tile">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      <p className="stat-note-line">{note ?? " "}</p>
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
        note={summary.charges ? `Suurin ${formatAmount(summary.largest)}` : undefined}
      />
      <Tile
        label="Keskiveloitus"
        value={formatAmount(summary.average)}
      />
      <Tile
        label="Henkilöitä"
        value={String(summary.people)}
        note={summary.people ? `${perPerson.toFixed(1).replace(".", ",")} veloitusta / henkilö` : undefined}
      />
      <Tile
        label="Saldoa lisätty"
        value={formatAmount(summary.deposits)}
        note={summary.depositCount === 1 ? "1 lisäys" : `${summary.depositCount} lisäystä`}
      />
      <Tile label="Saldoa jäljellä" value={formatAmount(summary.held)} />
      <Tile
        label="Miinuksella"
        value={formatAmount(summary.debt)}
        note={summary.debtors === 1 ? "1 henkilö" : `${summary.debtors} henkilöä`}
      />
      <Tile
        label="Perutut veloitukset"
        value={String(summary.undone)}
        note={summary.undone ? `${undoneShare} % veloituksista` : undefined}
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
    <main className="page stats">
      <div className="page-head">
        <h1 className="page-title">Tilastot</h1>
        <select
          className="input select input-sm event-select"
          aria-label="Tapahtuma"
          value={eventId}
          onChange={(event) => onEvent(event.target.value)}
        >
          {[...events].reverse().map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
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
      <p className="stats-note">
        Perutut kirjaukset eivät ole luvuissa mukana. Saldo ja miinus ovat tilanne valitun
        tapahtuman lopussa, ja niissä on mukana myös aiemmat tapahtumat.
      </p>
    </main>
  );
}
