import { useState } from "react";
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
  return (
    <section className="customers">
      <Flex gap="3" className="search-row">
        <Input
          aria-label="Hae henkilöä"
          placeholder="Hae henkilöä"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Button variant="ghost" className="add-person" disabled={disabled} onClick={add}>
          Lisää henkilö
        </Button>
        <Button variant="ghost" disabled={disabled} onClick={settings}>
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
            {table.getRowModel().rows.map((row) => (
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
                    onClick={() => {
                      if (!disabled) select(row.original.id);
                    }}
                  >
                    <span className="customer-name">{row.original.name}</span>
                  </button>
                </Table.Cell>
                <Table.Cell className="osakunta-cell" title={row.original.osakunta || undefined}>
                  {row.original.osakunta}
                </Table.Cell>
                <Table.Cell
                  textAlign="right"
                  className={row.original.balance < 0 ? "negative-balance" : undefined}
                  onClick={() => {
                    if (!disabled) select(row.original.id);
                  }}
                >
                  {formatAmount(row.original.balance)}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {!table.getRowModel().rows.length && (
          <Text p="8" className="empty-history">
            Ei hakutuloksia.
          </Text>
        )}
      </div>
    </section>
  );
}
