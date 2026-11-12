import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Box, Button, Dialog, Portal, Text } from "@chakra-ui/react";
import { useLedgerSession } from "./useLedgerSession";
import {
  fileAccessProblem,
  pickDatabase,
  saveDatabase,
  supportsDirectFiles,
} from "../persistence/database-file";
import { Ledger } from "../ledger";
import { type Entry, type Branding, defaultBranding } from "../ledger";
import { brandingStyle } from "../features/branding/theme";
import { CompatibilityBlock } from "../features/database/CompatibilityBlock";
import { BrandingForm } from "../features/branding/BrandingForm";
import { Settings } from "./Settings";
// Charts are only needed on the statistics view, so keep them out of the first load.
const EventStats = lazy(() =>
  import("./EventStats").then((module) => ({ default: module.EventStats })),
);
import { CustomerTable } from "../features/cashier/CustomerTable";
import { AccountPanel } from "../features/cashier/AccountPanel";
import { AddCustomerForm } from "../features/cashier/AddCustomerForm";
import { ReversalConfirmation } from "../features/cashier/ReversalConfirmation";
import { Welcome } from "../features/database/Welcome";
import { FileControls } from "../features/database/FileControls";
import { EventChoice } from "../features/database/EventChoice";
type Modal =
  | { kind: "event"; next: { ledger: Ledger; name: string } }
  | { kind: "create-event"; branding: Branding }
  | { kind: "onboarding" }
  | { kind: "customer" }
  | { kind: "settings" }
  | { kind: "reverse"; entry: Entry; customerName: string };
export default function App() {
  const problem = fileAccessProblem();
  if (problem) return <CompatibilityBlock problem={problem} />;
  return <CashierApp />;
}
function CashierApp() {
  const [dirty, setDirty] = useState(false);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [linkedFile, setLinkedFile] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const {
    active,
    activate: activateSession,
    data,
    mutation,
    error,
    setError,
  } = useLedgerSession({ onSaved: () => setDirty(!linkedFile) });
  const ledger = active.kind === "active" ? active.ledger : undefined;
  const fileName = active.kind === "active" ? active.name : "";
  function activate(next: { ledger: Ledger; name: string }) {
    activateSession(next);
    setView("cashier");
    setModal(undefined);
  }
  const [selected, setSelected] = useState<string>();
  const [view, setView] = useState<"cashier" | "stats">("cashier");
  const [modal, setModal] = useState<Modal>();
  const [dragging, setDragging] = useState(false);

  const input = useRef<HTMLInputElement>(null);
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
  async function chooseDatabase() {
    if (mutation.isPending || fileBusy || modal?.kind === "event" || modal?.kind === "create-event") return;
    if (!supportsDirectFiles()) return;
    if (
      dirty &&
      !window.confirm("Avataanko toinen tietokanta tallentamatta tätä kopiota?")
    )
      return;
    setFileBusy(true);
    try {
      const next = await pickDatabase();
      setModal({ kind: "event", next });
      setError("");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setError(error instanceof Error ? error.message : String(error));
    } finally {
      setFileBusy(false);
    }
  }
  async function open(file: File) {
    if (mutation.isPending || fileBusy || modal?.kind === "event" || modal?.kind === "create-event") return;
    if (
      dirty &&
      !window.confirm("Avataanko toinen tietokanta lataamatta varmuuskopiota?")
    )
      return;
    setFileBusy(true);
    try {
      const imported = await Ledger.open(
        new Uint8Array(await file.arrayBuffer()),
      );
      const next = await saveDatabase(imported, file.name);
      setModal({ kind: "event", next });
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Tietokannan avaaminen epäonnistui.",
      );
    } finally {
      setFileBusy(false);
    }
  }
  async function start(branding: Branding) {
    setError("");
    setModal({ kind: "create-event", branding });
  }
  function finishOpening(next: { ledger: Ledger; name: string }) {
    activate(next);
    setLinkedFile(true);
    setDirty(false);
    setSelected(undefined);
    setError("");
  }
  async function createEvent(name: string) {
    if (fileBusy || mutation.isPending) return;
    setFileBusy(true);
    try {
      if (modal?.kind === "event") {
        await modal.next.ledger.startEvent(name);
        finishOpening(modal.next);
      } else if (modal?.kind === "create-event") {
        const next = await Ledger.create({ name });
        await next.saveBranding(modal.branding);
        finishOpening(await saveDatabase(next, "customers.sqlite"));
      }
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
  const brandStyle = brandingStyle(branding);
  const fileControls = (
    <FileControls
      busy={busy}
      error={error}
      onOpen={() => void chooseDatabase()}
      onBackup={download}
    />
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
      <header
        className="masthead"
        aria-label={ledger ? branding.organization : "Piikki"}
      >
        {ledger && branding.logo && (
          <img
            className="organization-logo"
            src={branding.logo}
            alt={`${branding.organization} logo`}
          />
        )}
        {ledger && (
          <>
            <span className="organization-name">{branding.organization}</span>
            <span className="masthead-divider" aria-hidden="true">
              /
            </span>
          </>
        )}
        <span className="wordmark">Piikki</span>
        {data && <span className="event-name">{data.event.name}</span>}
        {ledger && (
          <Button
            variant="ghost"
            className="view-switch"
            disabled={busy}
            onClick={() => setView(view === "stats" ? "cashier" : "stats")}
          >
            {view === "stats" ? "Kassa" : "Tilastot"}
          </Button>
        )}
      </header>
      {!ledger ? (
        <Welcome
          busy={fileBusy}
          error={modal ? "" : error}
          onOpen={() => void chooseDatabase()}
          onCreate={() => {
            setError("");
            setModal({ kind: "onboarding" });
          }}
        />
      ) : view === "stats" ? (
        <Suspense fallback={null}>
          <EventStats
            ledger={ledger}
            revision={active.kind === "active" ? active.revision : 0}
          />
        </Suspense>
      ) : (
        <main className="workspace">
          <CustomerTable
            customers={data?.customers ?? []}
            selected={selected}
            disabled={busy}
            select={(id) => {
              setSelected(id);
              setSelectionRevision((revision) => revision + 1);
              setError("");
            }}
            add={() => {
              setModal({ kind: "customer" });
            }}
            settings={() => {
              setError("");
              setModal({ kind: "settings" });
            }}
          />
          <AccountPanel
            key={active.kind === "active" ? active.revision : 0}
            selectionRevision={selectionRevision}
            customer={customer}
            entries={entries}
            products={data?.products ?? []}
            busy={busy}
            error={modal ? "" : error}
            setError={setError}
            onPost={(input) => mutation.mutateAsync(() => ledger.post(input))}
            onSaveNote={(customerId, note) =>
              mutation.mutateAsync(() => ledger.saveCustomerNote(customerId, note))
            }
            onReverse={(entry) => {
              setError("");
              setModal({
                kind: "reverse",
                entry,
                customerName: customer?.name ?? "",
              });
            }}
          />
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
              className={`modal ${modal?.kind === "settings" || modal?.kind === "onboarding" ? "settings-modal" : ""}`}
              style={brandStyle}
              aria-label={
                modal?.kind === "event" || modal?.kind === "create-event"
                  ? "Valitse tapahtuma"
                  : modal?.kind === "onboarding"
                  ? "Organisaation tiedot"
                  : modal?.kind === "settings"
                    ? "Asetukset"
                    : modal?.kind === "customer"
                      ? "Lisää henkilö"
                      : "Peru tapahtuma"
              }
            >
              <Dialog.Body>
                {(modal?.kind === "event" || modal?.kind === "create-event") && (
                  <>
                    <Dialog.Title>Valitse tapahtuma</Dialog.Title>
                    <EventChoice
                      previousName={modal.kind === "event" ? modal.next.ledger.latestEvent().name : undefined}
                      busy={busy}
                      onContinue={() => {
                        if (modal.kind === "event") finishOpening(modal.next);
                      }}
                      onCreate={createEvent}
                    />
                  </>
                )}
                {modal?.kind === "onboarding" && (
                  <>
                    <Dialog.Title>Organisaation tiedot</Dialog.Title>
                    <BrandingForm
                      initial={{ ...defaultBranding, organization: "" }}
                      busy={busy}
                      submitLabel="Luo tietokanta"
                      save={start}
                    />
                  </>
                )}
                {modal?.kind === "customer" && (
                  <AddCustomerForm
                    busy={busy}
                    save={async (name, osakunta) => {
                      await mutation.mutateAsync(() =>
                        ledger?.addCustomer(name, "", osakunta),
                      );
                      setModal(undefined);
                    }}
                  />
                )}
                {modal?.kind === "settings" && ledger && data && (
                  <Settings
                    snapshot={data}
                    busy={busy}
                    saveBranding={(value) =>
                      mutation.mutateAsync(() => ledger.saveBranding(value))
                    }
                    saveProduct={(value) =>
                      mutation.mutateAsync(() => ledger.saveProduct(value))
                    }
                    removeProduct={(id) =>
                      mutation.mutateAsync(() => ledger.removeProduct(id))
                    }
                    files={fileControls}
                  />
                )}
                {modal?.kind === "reverse" && (
                  <ReversalConfirmation
                    entry={modal.entry}
                    customerName={modal.customerName}
                    busy={busy}
                    confirm={async () => {
                      await mutation.mutateAsync(() =>
                        ledger?.reverse(modal.entry.id),
                      );
                      setModal(undefined);
                    }}
                  />
                )}
                {error && modal && modal.kind !== "settings" && (
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
                  {modal?.kind === "settings" ? "Valmis" : "Peruuta"}
                </Button>
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
}
