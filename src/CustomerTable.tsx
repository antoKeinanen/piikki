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
import { type Customer, formatAmount } from "./model";
const columns: ColumnDef<Customer>[] = [
  { accessorKey: "name" },
  { accessorKey: "balance" },
];
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
  const [sorting, setSorting] = useState<SortingState>([]);
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
  return (
    <section className="customers">
      <Flex gap="3" className="search-row">
        <Input
          aria-label="Hae henkilöä"
          placeholder="Hae henkilöä"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Button variant="ghost" disabled={disabled} onClick={add}>
          Lisää henkilö
        </Button>
        <Button variant="ghost" disabled={disabled} onClick={settings}>
          Asetukset
        </Button>
      </Flex>
      <Table.Root size="lg">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader aria-sort={sorting[0]?.id === "name" ? (sorting[0].desc ? "descending" : "ascending") : "none"}>
              <button onClick={() => table.getColumn("name")?.toggleSorting()}>
                Nimi
              </button>
            </Table.ColumnHeader>
            <Table.ColumnHeader textAlign="right" aria-sort={sorting[0]?.id === "balance" ? (sorting[0].desc ? "descending" : "ascending") : "none"}>
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
                  <span>
                    <span className="customer-name">{row.original.name}</span>
                  </span>
                </button>
              </Table.Cell>
              <Table.Cell
                textAlign="right"
                fontWeight="600"
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
        <Text p="8" color="gray.500">
          Ei hakutuloksia.
        </Text>
      )}
    </section>
  );
}
