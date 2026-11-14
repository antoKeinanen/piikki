import { useRef, useState } from "react";
import { Button, Input, Table, Text, Flex } from "@chakra-ui/react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { type Customer, formatAmount } from "../../ledger";
const columns: ColumnDef<Customer>[] = [
  { accessorKey: "name" },
  { accessorKey: "osakunta" },
  { accessorKey: "balance" },
  {
    id: "recent",
    // ISO timestamps sort as text; people without entries sort last.
    accessorFn: (customer) => customer.last_activity ?? "",
    enableGlobalFilter: false,
    sortDescFirst: true,
  },
];
/** The usual regulars come first: latest balance change at the top. */
const RECENT_FIRST: SortingState = [{ id: "recent", desc: true }];
export function CustomerTable({
  customers,
  selected,
  select,
  add,
  settings,
  disabled,
}: {
  customers: Customer[];
  selected?: string;
  select: (id: string) => void;
  add: () => void;
  settings: () => void;
  disabled: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>(RECENT_FIRST);
  // On a phone the list folds away after a pick; "browsing" reopens it.
  const [browsing, setBrowsing] = useState(false);
  const [browsingFor, setBrowsingFor] = useState(selected);
  if (browsingFor !== selected) {
    setBrowsingFor(selected);
    setBrowsing(false);
  }
  const current = customers.find((customer) => customer.id === selected);
  const pick = (id: string) => {
    if (disabled) return;
    setBrowsing(false);
    select(id);
  };
  const table = useReactTable({
    data: customers,
    columns,
    state: { globalFilter: filter, sorting },
    onGlobalFilterChange: setFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const sortedBy = (id: string) =>
    sorting[0]?.id === id ? (sorting[0].desc ? "descending" : "ascending") : "none";
  const recent = sorting[0]?.id === "recent";
  // While someone is selected, a charge must not move rows under the cashier's finger.
  const frozen = useRef<{ selected?: string; ids: string[] }>({ ids: [] });
  let rows = table.getRowModel().rows;
  if (recent && selected && frozen.current.selected === selected) {
    const index = new Map(frozen.current.ids.map((id, i) => [id, i]));
    rows = [...rows].sort((a, b) => (index.get(a.original.id) ?? -1) - (index.get(b.original.id) ?? -1));
  }
  frozen.current = { selected, ids: rows.map((row) => row.original.id) };
  return (
    <section className={`customers ${current && !browsing ? "collapsed" : ""}`}>
      {current && (
        <div className="selected-bar">
          <div className="selected-bar-identity">
            <span className="selected-bar-name" title={current.name}>
              {current.name}
            </span>
            {current.osakunta && (
              <span className="selected-bar-osakunta">{current.osakunta}</span>
            )}
          </div>
          <span className="selected-bar-balance">
            <span className="selected-bar-balance-label">Saldo</span>{" "}
            <strong className={current.balance < 0 ? "negative-balance" : undefined}>
              {formatAmount(current.balance)}
            </strong>
          </span>
          <button
            type="button"
            className="selected-bar-switch secondary"
            aria-expanded={browsing}
            onClick={() => setBrowsing(!browsing)}
          >
            {browsing ? "Piilota lista" : "Vaihda henkilö"}
          </button>
        </div>
      )}
      <Flex className="search-row">
        <Input
          aria-label="Hae henkilöä"
          placeholder="Hae henkilöä"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Button variant="ghost" className="secondary" disabled={disabled} onClick={add}>
          Lisää henkilö
        </Button>
        <Button variant="ghost" className="secondary" disabled={disabled} onClick={settings}>
          Asetukset
        </Button>
      </Flex>
      <div className="sort-row">
        <span>Järjestys</span>
        <span className="sort-options">
        <button
          type="button"
          aria-pressed={recent}
          onClick={() => setSorting(RECENT_FIRST)}
        >
          Viimeisin tapahtuma
        </button>
        <button
          type="button"
          aria-pressed={sorting[0]?.id === "name"}
          onClick={() => setSorting([{ id: "name", desc: false }])}
        >
          Aakkosjärjestys
        </button>
        </span>
      </div>
      <div className="customer-scroll">
        <Table.Root size="lg" className="customer-table">
          <colgroup>
            <col />
            <col className="osakunta-column" />
            <col className="balance-column" />
          </colgroup>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader aria-sort={sortedBy("name")}>
                <button onClick={() => table.getColumn("name")?.toggleSorting()}>
                  Nimi
                </button>
              </Table.ColumnHeader>
              <Table.ColumnHeader aria-sort={sortedBy("osakunta")}>
                <button onClick={() => table.getColumn("osakunta")?.toggleSorting()}>
                  Osakunta
                </button>
              </Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right" aria-sort={sortedBy("balance")}>
                <button
                  onClick={() => table.getColumn("balance")?.toggleSorting()}
                >
                  Saldo
                </button>
              </Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((row) => (
              <Table.Row
                key={row.id}
                data-selected={row.original.id === selected}
                className="customer-row"
              >
                <Table.Cell>
                  <button
                    className="customer-select"
                    disabled={disabled}
                    aria-pressed={row.original.id === selected}
                    onClick={() => pick(row.original.id)}
                  >
                    <span className="customer-check" aria-hidden="true">
                      <svg viewBox="0 0 16 16" width="12" height="12">
                        <path
                          d="m3.5 8.5 3 3 6-7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className="customer-text">
                      <span className="customer-name">{row.original.name}</span>
                      {row.original.osakunta && (
                        <span className="customer-meta">{row.original.osakunta}</span>
                      )}
                    </span>
                  </button>
                </Table.Cell>
                <Table.Cell className="osakunta-cell" title={row.original.osakunta || undefined}>
                  {row.original.osakunta}
                </Table.Cell>
                <Table.Cell
                  textAlign="right"
                  className={row.original.balance < 0 ? "negative-balance" : undefined}
                  onClick={() => pick(row.original.id)}
                >
                  {formatAmount(row.original.balance)}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {!rows.length && (
          <Text p="8" className="empty-history">
            Ei hakutuloksia.
          </Text>
        )}
      </div>
    </section>
  );
}
