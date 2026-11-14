import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Box, Button, Dialog, Portal, Text } from "@chakra-ui/react";
import { useLedgerSession } from "./useLedgerSession";
import {
  fileAccessProblem,
  pickDatabase,
  saveDatabase,
  supportsDirectFiles,
  unlockBytes,
  type OpenedDatabase,
} from "../persistence/database-file";
import { Ledger } from "../ledger";
import { type Customer, type Entry, type Branding, defaultBranding } from "../ledger";
import { brandingStyle } from "../features/branding/theme";
import { CompatibilityBlock } from "../features/database/CompatibilityBlock";
import { BrandingForm } from "../features/branding/BrandingForm";
import { Settings } from "./Settings";
// Charts are only needed on the statistics view, so keep them out of the first load.
const EventStats = lazy(() =>
  import("./EventStats").then((module) => ({ default: module.EventStats })),
);
import { CustomerTable } from "../features/cashier/CustomerTable";
import { AccountPanel, entryTitle } from "../features/cashier/AccountPanel";
import { CustomerForm } from "../features/cashier/CustomerForm";
import { EditCustomer } from "../features/cashier/EditCustomer";
import { UndoNotice, type Undo } from "../features/cashier/UndoNotice";
import { ReversalConfirmation } from "../features/cashier/ReversalConfirmation";
import { Welcome } from "../features/database/Welcome";
import { FileControls } from "../features/database/FileControls";
import { EventChoice } from "../features/database/EventChoice";
import { OperatorPrompt } from "../features/cashier/OperatorPrompt";
/** With no input for this long, the selected person is cleared so nobody gets charged by mistake. */
export const IDLE_TIMEOUT_MS = 2 * 60 * 1000;
const NEUTRAL_BRANDING: Branding = { ...defaultBranding, primary: "#1F2A2E", secondary: "#F4F3EF" };
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "input"] as const;
type Modal =
  | { kind: "event"; next: OpenedDatabase }
  | { kind: "operator" }
  | { kind: "create-event"; branding: Branding }
  | { kind: "onboarding" }
  | { kind: "customer" }
  | { kind: "edit-customer"; customer: Customer }
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
  const [operator, setOperator] = useState("");
  const {
    active,
    activate: activateSession,
    close: closeSession,
    data,
    mutation,
    error,
    setError,
  } = useLedgerSession({ onSaved: () => setDirty(!linkedFile) });
  const ledger = active.kind === "active" ? active.ledger : undefined;
  const fileName = active.kind === "active" ? active.name : "";
  const protection = active.kind === "active" ? active.protection : undefined;
  function activate(next: OpenedDatabase) {
    activateSession(next);
    setUndo(undefined);
    setView("cashier");
    setModal(undefined);
  }
  const [selected, setSelected] = useState<string>();
  const [view, setView] = useState<"cashier" | "stats">("cashier");
  const [modal, setModal] = useState<Modal>();
  const [undo, setUndo] = useState<Undo>();
  const [dragging, setDragging] = useState(false);

  const input = useRef<HTMLInputElement>(null);
  const customer = data?.customers.find((c) => c.id === selected);
  const entries = data?.entries.filter((e) => e.customer_id === selected) ?? [];
  useEffect(() => {
    // Nobody is selected until the cashier picks someone.
    if (data && selected && !data.customers.some((c) => c.id === selected))
      setSelected(undefined);
  }, [data, selected]);
  useEffect(() => {
    if (!selected) return;
    const expire = () => {
      setSelected(undefined);
      setModal((current) =>
        current?.kind === "reverse" || current?.kind === "edit-customer" ? undefined : current,
      );
    };
    let timer = setTimeout(expire, IDLE_TIMEOUT_MS);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(expire, IDLE_TIMEOUT_MS);
    };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, reset, true);
    return () => {
      clearTimeout(timer);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, reset, true);
    };
  }, [selected]);

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
      const { plain, fileKey } = await unlockBytes(
        new Uint8Array(await file.arrayBuffer()),
      );
      const imported = await Ledger.open(plain);
      const next = await saveDatabase(imported, file.name, fileKey);
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
  function finishOpening(next: OpenedDatabase) {
    activate(next);
    setLinkedFile(true);
    setDirty(false);
    setSelected(undefined);
    setError("");
    if (!operator) setModal({ kind: "operator" });
  }
  function logout() {
    if (busy) return;
    if (dirty && !window.confirm("Kirjaudutaanko ulos lataamatta varmuuskopiota?")) return;
    closeSession();
    setOperator("");
    setSelected(undefined);
    setUndo(undefined);
    setModal(undefined);
    setView("cashier");
    setLinkedFile(false);
    setDirty(false);
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
  async function download() {
    if (!ledger) return;
    // An encrypted database gets an encrypted backup with the same password.
    const bytes = protection ? await protection.backup() : ledger.export();
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
  async function editCustomer(before: Customer, name: string, osakunta: string) {
    if (!ledger) return;
    await mutation.mutateAsync(() => ledger.updateCustomer(before.id, { name, osakunta }));
    setModal(undefined);
    setUndo({
      message: `Henkilön ${before.name} tiedot muutettu.`,
      action: "Kumoa muutos",
      run: () =>
        mutation.mutateAsync(() =>
          ledger.updateCustomer(before.id, { name: before.name, osakunta: before.osakunta }),
        ),
    });
  }
  async function removeCustomer(person: Customer) {
    if (!ledger) return;
    await mutation.mutateAsync(() => ledger.removeCustomer(person.id));
    setModal(undefined);
    setUndo({
      message: `${person.name} poistettu.`,
      action: `Palauta ${person.name}`,
      run: () => restoreCustomer(person.id),
      restores: person.id,
    });
  }
  async function restoreCustomer(id: string) {
    if (!ledger) return;
    await mutation.mutateAsync(() => ledger.restoreCustomer(id));
    setSelected(id);
    setSelectionRevision((revision) => revision + 1);
    setUndo((current) => (current?.restores === id ? undefined : current));
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
  // Before a file opens there is no organization yet, so use a soft neutral background.
  const brandStyle = brandingStyle(data?.branding ?? NEUTRAL_BRANDING);
  const modalStyle =
    modal?.kind === "event" ? brandingStyle(modal.next.ledger.snapshot().branding) : brandStyle;
  const osakunnat = data
    ? [...data.customers, ...data.removedCustomers].map((c) => c.osakunta).concat(branding.organization)
    : [];
  const people = data
    ? [...data.customers, ...data.removedCustomers.map((c) => ({ ...c, removed: true }))]
    : [];
  function choose(id: string) {
    setSelected(id);
    setSelectionRevision((revision) => revision + 1);
    setError("");
    // On a phone the account panel sits below the list, so bring it into view.
    if (window.matchMedia?.("(max-width: 800px)").matches)
      requestAnimationFrame(() =>
        document.querySelector(".account")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
  }
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
        <div className="masthead-brand">
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
        </div>
        {ledger && (
          <nav className="masthead-actions" aria-label="Valikko">
            {operator && (
              <Button
                variant="ghost"
                className="operator-switch outline-action"
                aria-label={`Vuorossa ${operator}, vaihda`}
                disabled={busy}
                onClick={() => setModal({ kind: "operator" })}
              >
                <span className="operator-label">Vuorossa</span> {operator}
              </Button>
            )}
            <Button
              variant="ghost"
              className="view-switch outline-action"
              disabled={busy}
              onClick={() => setView(view === "stats" ? "cashier" : "stats")}
            >
              {view === "stats" ? "Tilit" : "Tilastot"}
            </Button>
            <Button variant="ghost" className="logout outline-action" disabled={busy} onClick={logout}>
              Kirjaudu ulos
            </Button>
          </nav>
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
            select={choose}
            add={() => {
              setModal({ kind: "customer" });
            }}
            settings={() => {
              setError("");
              setModal({ kind: "settings" });
            }}
            edit={() => {
              if (!customer) return;
              setError("");
              setModal({ kind: "edit-customer", customer });
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
            onPost={(input) => mutation.mutateAsync(() => ledger.post({ ...input, operator }))}
            onSaveNote={(customerId, note) =>
              mutation.mutateAsync(() => ledger.saveCustomerNote(customerId, note))
            }
            onEdit={() => {
              if (customer) setModal({ kind: "edit-customer", customer });
            }}
            notice={
              undo && (
                <UndoNotice undo={undo} busy={busy} dismiss={() => setUndo(undefined)} />
              )
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
          if (event.open) return;
          if (modal?.kind === "operator" && !operator) return;
          else if (!busy) {
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
              className={`modal ${modal?.kind === "settings" || modal?.kind === "onboarding" ? "settings-modal" : ""} ${modal?.kind === "settings" ? "settings-shell" : ""}`}
              style={modalStyle}
              aria-label={
                modal?.kind === "event" || modal?.kind === "create-event"
                  ? "Valitse tapahtuma"
                  : modal?.kind === "operator"
                  ? "Kuka on vuorossa?"
                  : modal?.kind === "onboarding"
                  ? "Organisaation tiedot"
                  : modal?.kind === "settings"
                    ? "Asetukset"
                    : modal?.kind === "customer"
                      ? "Lisää henkilö"
                      : modal?.kind === "edit-customer"
                        ? "Muokkaa henkilöä"
                        : modal?.kind === "reverse" && modal.entry.cents > 0
                          ? "Kumoa saldon lisäys?"
                          : "Kumoa veloitus?"
              }
            >
              <Dialog.Body>
                {modal?.kind === "operator" && (
                  <>
                    <Dialog.Title>Kuka on vuorossa?</Dialog.Title>
                    <OperatorPrompt
                      current={operator}
                      recent={ledger?.operators() ?? []}
                      choose={(name) => {
                        setOperator(name);
                        setModal(undefined);
                      }}
                    />
                  </>
                )}
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
                  <>
                  <Dialog.Title>Lisää henkilö</Dialog.Title>
                  <CustomerForm
                    busy={busy}
                    withOpening
                    osakunnat={osakunnat}
                    people={people}
                    onPick={(id) => {
                      choose(id);
                      setModal(undefined);
                    }}
                    save={async ({ name, osakunta, openingCents }) => {
                      if (!ledger) return;
                      let id = "";
                      await mutation.mutateAsync(async () => {
                        id = await ledger.addCustomer(name, "", osakunta, { openingCents, operator });
                      });
                      setModal(undefined);
                      choose(id);
                    }}
                  />
                  </>
                )}
                {modal?.kind === "edit-customer" && (
                  <>
                    <Dialog.Title>Muokkaa henkilöä</Dialog.Title>
                    <EditCustomer
                      customer={modal.customer}
                      busy={busy}
                      osakunnat={osakunnat}
                      people={people}
                      save={(name, osakunta) => editCustomer(modal.customer, name, osakunta)}
                      remove={() => removeCustomer(modal.customer)}
                    />
                  </>
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
                    restoreCustomer={restoreCustomer}
                    files={
                      <FileControls
                        busy={busy}
                        error={error}
                        onOpen={() => void chooseDatabase()}
                        onBackup={() => void download()}
                        note={
                          <Text className="file-saving-help" role="status">
                            {protection?.encrypted()
                              ? "Tiedosto on salattu. Ilman sovelluksen salasanaa sitä ei voi lukea, myös uloskirjautumisen jälkeen."
                              : "Tiedostoa ei salata, koska sovellukselle ei ole asetettu salasanaa."}
                          </Text>
                        }
                      />
                    }
                  />
                )}
                {modal?.kind === "reverse" && (
                  <ReversalConfirmation
                    entry={modal.entry}
                    title={entryTitle(modal.entry)}
                    balance={customer?.balance ?? 0}
                    customerName={modal.customerName}
                    busy={busy}
                    confirm={async () => {
                      await mutation.mutateAsync(() =>
                        ledger?.reverse(modal.entry.id, operator),
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
              </Dialog.Body>
              {!(modal?.kind === "operator" && !operator) && (
                <Dialog.Footer className="modal-footer">
                  <Button
                    variant="ghost"
                    className="close-modal"
                    disabled={busy}
                    onClick={() => {
                      setModal(undefined);
                      setError("");
                    }}
                  >
                    {modal?.kind === "settings" ? "Valmis" : modal?.kind === "reverse" ? "Takaisin" : "Peruuta"}
                  </Button>
                </Dialog.Footer>
              )}
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
}
