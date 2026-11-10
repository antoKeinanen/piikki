import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  Box,
  Button,
  Dialog,
  Flex,
  Input,
  Portal,
  Text,
  Field,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fileAccessProblem,
  pickDatabase,
  saveDatabase,
  supportsDirectFiles,
} from "./database-file";
import { Ledger, loadRecovery, createExample } from "./ledger";
import {
  formatAmount,
  parseAmount,
  type Entry,
  defaultBranding,
  readableText,
} from "./model";
import { CompatibilityBlock } from "./CompatibilityBlock";
import { Settings } from "./Settings";
import { CustomerTable } from "./CustomerTable";
import "./styles.css";
type Modal =
  | { kind: "customer" }
  | { kind: "settings" }
  | { kind: "reverse"; entry: Entry; customerName: string };
type BrandStyle = CSSProperties &
  Record<"--brand" | "--accent" | "--on-brand" | "--on-accent", string>;
function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      {children}
    </Field.Root>
  );
}
export default function App() {
  const problem = fileAccessProblem();
  if (problem) return <CompatibilityBlock problem={problem} />;
  return <CashierApp />;
}
function CashierApp() {
  const [linkedFile, setLinkedFile] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [ledger, setLedger] = useState<Ledger>();
  const [session, setSession] = useState(0);
  function activate(next: Ledger) {
    setLedger(next);
    setSession((value) => value + 1);
    setModal(undefined);
    setAmount("");

    setAction("charge");
  }
  function recovery() {
    try {
      return loadRecovery();
    } catch {
      return undefined;
    }
  }
  const [fileName, setFileName] = useState("");
  const [selected, setSelected] = useState<string>();
  const [modal, setModal] = useState<Modal>();
  const [amount, setAmount] = useState("");
  const [action, setAction] = useState<"charge" | "deposit">("charge");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [name, setName] = useState("");

  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["book", session],
    queryFn: () => ledger!.snapshot(),
    enabled: !!ledger,
  });
  const data = query.data;
  const customer = data?.customers.find((c) => c.id === selected);
  const entries = data?.entries.filter((e) => e.customer_id === selected) ?? [];
  useEffect(() => {
    if (data && !data.customers.some((c) => c.id === selected))
      setSelected(data.customers[0]?.id);
  }, [data, selected]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const mutation = useMutation({
    mutationFn: async (run: () => void | Promise<void>) => run(),
    onSuccess: async () => {
      setDirty(!linkedFile);
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["book"] });
    },
    onError: (e) => setError(e.message),
  });
  async function chooseDatabase() {
    if (mutation.isPending || fileBusy) return;
    if (!supportsDirectFiles()) return;
    if (
      dirty &&
      !window.confirm("Open another database without saving this copy?")
    )
      return;
    setFileBusy(true);
    try {
      const next = await pickDatabase();
      activate(next.ledger);
      setFileName(next.name);
      setLinkedFile(true);
      setDirty(false);
      setSelected(undefined);
      setError("");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setError(error instanceof Error ? error.message : String(error));
    } finally {
      setFileBusy(false);
    }
  }
  async function open(file: File) {
    if (mutation.isPending || fileBusy) return;
    if (
      dirty &&
      !window.confirm("Open another database without downloading a backup?")
    )
      return;
    try {
      const imported = await Ledger.open(
        new Uint8Array(await file.arrayBuffer()),
      );
      const next = await saveDatabase(imported, file.name);
      activate(next.ledger);
      setLinkedFile(true);
      setFileName(next.name);
      setDirty(false);
      setSelected(undefined);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not open this database.",
      );
    }
  }
  async function start(example: boolean) {
    if (fileBusy || mutation.isPending) return;
    setFileBusy(true);
    try {
      const next = example ? await createExample() : await Ledger.open();
      const saved = await saveDatabase(
        next,
        example ? "example.sqlite" : "customers.sqlite",
      );
      activate(saved.ledger);
      setFileName(saved.name);
      setLinkedFile(true);
      setDirty(false);
      setError("");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFileBusy(false);
    }
  }
  function download() {
    if (!ledger) return;
    const bytes = ledger.export();
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(bytes)], { type: "application/vnd.sqlite3" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDirty(false);
  }
  const busy = mutation.isPending || fileBusy;
  function post(kind: "charge" | "deposit", preset?: number) {
    if (!customer || !ledger || !linkedFile || busy) return;
    try {
      const cents = preset ?? parseAmount(amount);
      if (kind === "charge" && cents > customer.balance)
        throw new Error("Not enough balance for this charge.");
      setError("");
      mutation.mutate(
        () =>
          ledger.post({
            customerId: customer.id,
            cents,
            kind,
            label: kind === "charge" ? "Charge" : "Deposit",
          }),
        { onSuccess: () => setAmount("") },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  const fileInput = (
    <input
      ref={input}
      type="file"
      accept=".sqlite,.sqlite3,.db"
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void open(f);
        e.target.value = "";
      }}
    />
  );
  const branding = data?.branding ?? defaultBranding;
  const brandStyle: BrandStyle = {
    "--brand": branding.primary,
    "--accent": branding.secondary,
    "--on-brand": readableText(branding.primary),
    "--on-accent": readableText(branding.secondary),
  };
  const fileControls = (
    <>
      <Text className="file-saving-help">
        Changes save to your database file automatically.
      </Text>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => void chooseDatabase()}
      >
        Open database
      </Button>
      <Button variant="outline" disabled={busy} onClick={download}>
        Download backup
      </Button>
      {error && (
        <Text role="alert" className="error">
          {error}
        </Text>
      )}
    </>
  );
  return (
    <Box
      style={brandStyle}
      className={`app ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (
          !e.currentTarget.contains(
            e.relatedTarget instanceof Node ? e.relatedTarget : null,
          )
        )
          setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) void open(file);
      }}
    >
      {fileInput}
      {!ledger ? (
        <main className="welcome">
          <Button
            size="xl"
            className="primary"
            disabled={fileBusy}
            onClick={() => void chooseDatabase()}
          >
            Open database
          </Button>
          <span className="drop-label">or drop a SQLite file here</span>
          <Flex gap="3">
            <Button
              variant="ghost"
              disabled={fileBusy}
              onClick={() => void start(false)}
            >
              Create database
            </Button>
            <Button
              variant="ghost"
              disabled={fileBusy}
              onClick={() => void start(true)}
            >
              Try example
            </Button>
          </Flex>
          {recovery() && (
            <Button
              variant="plain"
              disabled={fileBusy}
              onClick={async () => {
                try {
                  const recovered = await Ledger.open(recovery());
                  const saved = await saveDatabase(
                    recovered,
                    "recovered.sqlite",
                  );
                  activate(saved.ledger);
                  setFileName(saved.name);
                  setLinkedFile(true);
                  setDirty(false);
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Restore local copy
            </Button>
          )}
          {error && (
            <Text role="alert" className="error">
              {error}
            </Text>
          )}
        </main>
      ) : (
        <main className="workspace">
          <CustomerTable
            customers={data?.customers ?? []}
            selected={selected}
            disabled={busy}
            select={(id) => {
              setSelected(id);
              setAmount("");
              setError("");
            }}
            add={() => {
              setName("");
              setModal({ kind: "customer" });
            }}
            settings={() => {
              setError("");
              setModal({ kind: "settings" });
            }}
          />
          <section className="account" aria-label="Selected customer">
            {customer ? (
              <>
                <div className="account-summary">
                  <Text className="account-name">{customer.name}</Text>
                  <Text className="balance" aria-label="Available balance">
                    {formatAmount(customer.balance)}
                  </Text>
                </div>
                <Flex
                  className="mode"
                  role="group"
                  aria-label="Transaction type"
                >
                  <Button
                    variant="plain"
                    className={action === "charge" ? "mode-active" : ""}
                    aria-pressed={action === "charge"}
                    disabled={busy}
                    onClick={() => {
                      setAction("charge");
                      setAmount("");
                      setError("");
                    }}
                  >
                    Charge
                  </Button>
                  <Button
                    variant="plain"
                    className={action === "deposit" ? "mode-active" : ""}
                    aria-pressed={action === "deposit"}
                    disabled={busy}
                    onClick={() => {
                      setAction("deposit");
                      setAmount("");
                      setError("");
                    }}
                  >
                    Deposit
                  </Button>
                </Flex>
                {action === "charge" && !!data?.presets.length && (
                  <div className="quick-charges">
                    {data.presets.map((p) => (
                      <Button
                        key={p.id}
                        variant="outline"
                        className="quick-charge"
                        aria-label={`Charge ${formatAmount(p.cents)}`}
                        disabled={busy || p.cents > customer.balance}
                        onClick={() => post("charge", p.cents)}
                      >
                        {formatAmount(p.cents)}
                      </Button>
                    ))}
                  </div>
                )}
                <form
                  className="amount-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    post(action);
                  }}
                >
                  <FormField
                    label={
                      action === "charge"
                        ? "Custom amount"
                        : "Amount to deposit"
                    }
                  >
                    <Input
                      aria-label="Amount"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      disabled={busy}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </FormField>
                  <Button
                    className="primary"
                    type="submit"
                    disabled={!amount || busy}
                  >
                    {action === "charge" ? "Charge" : "Deposit"}
                    {amount && /^\d+([.,]\d{1,2})?$/.test(amount)
                      ? ` ${formatAmount(Math.round(Number(amount.replace(",", ".")) * 100))}`
                      : ""}
                  </Button>
                </form>
                {error && (
                  <Text role="alert" className="error">
                    {error}
                  </Text>
                )}
                <div className="history" aria-label="Transaction history">
                  {!entries.length && (
                    <Text className="empty-history">No transactions yet.</Text>
                  )}
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`entry ${entry.reversed ? "reversed" : ""}`}
                    >
                      <div>
                        <Text className="entry-label">
                          {entry.reversal_of
                            ? "Reversal"
                            : entry.cents < 0
                              ? "Charge"
                              : "Deposit"}
                        </Text>
                        <Text className="entry-date">
                          {new Date(entry.created_at).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {entry.reversed ? " · Reversed" : ""}
                        </Text>
                      </div>
                      <Text className="entry-amount">
                        {entry.cents > 0 ? "+" : "−"}
                        {formatAmount(Math.abs(entry.cents))}
                      </Text>
                      {!entry.reversal_of && !entry.reversed ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            setError("");
                            setModal({
                              kind: "reverse",
                              entry,
                              customerName: customer.name,
                            });
                          }}
                        >
                          Undo
                        </Button>
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Text className="empty-account">Select or add a customer.</Text>
            )}
            {error && !customer && (
              <Text role="alert" className="error">
                {error}
              </Text>
            )}
          </section>
        </main>
      )}
      <Dialog.Root
        lazyMount
        unmountOnExit
        open={!!modal}
        onOpenChange={(event) => {
          if (!event.open && !busy) {
            setModal(undefined);
            setError("");
          }
        }}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content
              className={`modal ${modal?.kind === "settings" ? "settings-modal" : ""}`}
              style={brandStyle}
              aria-label={
                modal?.kind === "settings"
                  ? "Settings"
                  : modal?.kind === "customer"
                    ? "Add customer"
                    : "Reverse transaction"
              }
            >
              <Dialog.Body>
                {modal?.kind === "customer" && (
                  <form
                    className="settings-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      mutation.mutate(
                        () => ledger?.addCustomer(name.trim(), ""),
                        { onSuccess: () => setModal(undefined) },
                      );
                    }}
                  >
                    <FormField label="Customer name">
                      <Input
                        autoFocus
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </FormField>
                    <Button
                      className="primary"
                      type="submit"
                      disabled={!name.trim() || busy}
                    >
                      Add customer
                    </Button>
                  </form>
                )}
                {modal?.kind === "settings" && ledger && data && (
                  <Settings
                    ledger={ledger}
                    snapshot={data}
                    busy={busy}
                    run={(operation) => mutation.mutateAsync(operation)}
                    files={fileControls}
                  />
                )}
                {modal?.kind === "reverse" && (
                  <div className="settings-form">
                    <Text className="reversal-name">{modal.customerName}</Text>
                    <Text>
                      Reverse {modal.entry.cents < 0 ? "charge" : "deposit"} of{" "}
                      {formatAmount(Math.abs(modal.entry.cents))}?
                    </Text>
                    <Button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        mutation.mutate(() => ledger?.reverse(modal.entry.id), {
                          onSuccess: () => setModal(undefined),
                        })
                      }
                    >
                      Reverse transaction
                    </Button>
                  </div>
                )}
                {error && modal?.kind !== "settings" && (
                  <Text role="alert" className="error">
                    {error}
                  </Text>
                )}
                <Button
                  variant="ghost"
                  className="close-modal"
                  disabled={busy}
                  onClick={() => {
                    setModal(undefined);
                    setError("");
                  }}
                >
                  {modal?.kind === "settings" ? "Done" : "Cancel"}
                </Button>
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
}
