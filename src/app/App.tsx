import { lazy, Suspense, useEffect, useState } from "react";
import { Dialog, Portal } from "@chakra-ui/react";
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
import { PeopleList } from "../features/cashier/PeopleList";
import { AccountPanel, entryTitle, signedAmount } from "../features/cashier/AccountPanel";
import { CustomerForm, type CustomerValues } from "../features/cashier/CustomerForm";
import { EditCustomer } from "../features/cashier/EditCustomer";
import { Toast } from "../features/cashier/Toast";
import { ReversalConfirmation } from "../features/cashier/ReversalConfirmation";
import { Welcome } from "../features/database/Welcome";
import { FileControls } from "../features/database/FileControls";
import { EventChoice } from "../features/database/EventChoice";
import { OperatorPrompt } from "../features/cashier/OperatorPrompt";
import { DialogActions } from "../ui/DialogActions";
// Charts are only needed on the statistics view, so keep them out of the first load.
const EventStats = lazy(() =>
  import("./EventStats").then((module) => ({ default: module.EventStats })),
);
/** With no input for this long, the selected person is cleared so nobody gets charged by mistake. */
export const IDLE_TIMEOUT_MS = 2 * 60 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "input"] as const;
type View = "cashier" | "stats" | "settings";
const VIEWS: { id: View; label: string }[] = [
  { id: "cashier", label: "Kassa" },
  { id: "stats", label: "Tilastot" },
  { id: "settings", label: "Asetukset" },
];
type Modal =
  | { kind: "event"; next: OpenedDatabase }
  | { kind: "operator" }
  | { kind: "create-event"; branding: Branding }
  | { kind: "onboarding" }
  | { kind: "customer"; name: string }
  | { kind: "edit-customer"; customer: Customer }
  | { kind: "reverse"; entry: Entry; customerName: string };
const MODAL_TITLES: Record<Modal["kind"], string> = {
  event: "Valitse tapahtuma",
  "create-event": "Valitse tapahtuma",
  operator: "Kuka on vuorossa?",
  onboarding: "Uusi tietokanta",
  customer: "Lisää henkilö",
  "edit-customer": "Muokkaa henkilöä",
  reverse: "Perutaanko kirjaus?",
};
/** The latest change, shown at the bottom with a way to undo it. */
type Notice =
  | { kind: "entry"; entryId: string; customerName: string; cents: number; label: string }
  | { kind: "undo"; message: string; action: string; run(): Promise<void>; restores?: string };

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
  const [selected, setSelected] = useState<string>();
  const [view, setView] = useState<View>("cashier");
  const [modal, setModal] = useState<Modal>();
  const [notice, setNotice] = useState<Notice>();
  const [dragging, setDragging] = useState(false);
  function activate(next: OpenedDatabase) {
    activateSession(next);
    setNotice(undefined);
    setView("cashier");
    setModal(undefined);
  }
  const customer = data?.customers.find((c) => c.id === selected);
  const entries = data?.entries.filter((e) => e.customer_id === selected) ?? [];
  useEffect(() => {
    if (data && selected && !data.customers.some((c) => c.id === selected))
      setSelected(undefined);
  }, [data, selected]);
  useEffect(() => {
    if (!selected) return;
    const expire = () => {
      setSelected(undefined);
      setNotice(undefined);
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
  const busy = mutation.isPending || fileBusy;
  const choosing = modal?.kind === "event" || modal?.kind === "create-event";
  async function chooseDatabase() {
    if (busy || choosing || !supportsDirectFiles()) return;
    if (dirty && !window.confirm("Avataanko toinen tietokanta? Tämän tiedoston muutokset eivät ole tallessa."))
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
    if (busy || choosing) return;
    if (dirty && !window.confirm("Avataanko toinen tietokanta? Tämän tiedoston muutokset eivät ole tallessa."))
      return;
    setFileBusy(true);
    try {
      const { plain, fileKey } = await unlockBytes(new Uint8Array(await file.arrayBuffer()));
      const imported = await Ledger.open(plain);
      const next = await saveDatabase(imported, file.name, fileKey);
      setModal({ kind: "event", next });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tietokantaa ei voitu avata.");
    } finally {
      setFileBusy(false);
    }
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
    if (dirty && !window.confirm("Kirjaudutaanko ulos? Tämän tiedoston muutokset eivät ole tallessa.")) return;
    closeSession();
    setOperator("");
    setSelected(undefined);
    setNotice(undefined);
    setModal(undefined);
    setView("cashier");
    setLinkedFile(false);
    setDirty(false);
  }
  async function createEvent(name: string) {
    if (busy) return;
    setFileBusy(true);
    try {
      if (modal?.kind === "event") {
        await modal.next.ledger.startEvent(name);
        finishOpening(modal.next);
      } else if (modal?.kind === "create-event") {
        const next = await Ledger.create({ name });
        await next.saveBranding(modal.branding);
        finishOpening(await saveDatabase(next, "piikki.sqlite"));
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
  async function editCustomer(before: Customer, values: CustomerValues) {
    if (!ledger) return;
    const details = values.name !== before.name || values.osakunta !== before.osakunta;
    await mutation.mutateAsync(async () => {
      if (details) await ledger.updateCustomer(before.id, values);
      if (values.note !== before.note) await ledger.saveCustomerNote(before.id, values.note);
    });
    setModal(undefined);
    setNotice({
      kind: "undo",
      message: `${values.name}: tiedot tallennettu.`,
      action: "Kumoa",
      run: () =>
        mutation.mutateAsync(async () => {
          if (details)
            await ledger.updateCustomer(before.id, { name: before.name, osakunta: before.osakunta });
          if (values.note !== before.note) await ledger.saveCustomerNote(before.id, before.note);
        }),
    });
  }
  async function removeCustomer(person: Customer) {
    if (!ledger) return;
    await mutation.mutateAsync(() => ledger.removeCustomer(person.id));
    setModal(undefined);
    setNotice({
      kind: "undo",
      message: `${person.name} poistettu.`,
      action: `Palauta ${person.name}`,
      run: () => restoreCustomer(person.id),
      restores: person.id,
    });
  }
  async function restoreCustomer(id: string) {
    if (!ledger) return;
    await mutation.mutateAsync(() => ledger.restoreCustomer(id));
    choose(id);
    setNotice((current) => (current?.kind === "undo" && current.restores === id ? undefined : current));
  }
  const branding = data?.branding ?? defaultBranding;
  const brandStyle = brandingStyle(branding);
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
  }
  function closeModal() {
    if (busy) return;
    setModal(undefined);
    setError("");
  }
  function openReversal(entry: Entry) {
    const owner = data?.customers.find((c) => c.id === entry.customer_id);
    setError("");
    setModal({ kind: "reverse", entry, customerName: owner?.name ?? "" });
  }
  // An entry notice disappears once its entry has been undone.
  const noticeEntry =
    notice?.kind === "entry" ? data?.entries.find((e) => e.id === notice.entryId) : undefined;
  const shownNotice = notice?.kind === "entry" && (!noticeEntry || noticeEntry.reversed) ? undefined : notice;
  const mustChooseOperator = modal?.kind === "operator" && !operator;
  return (
    <div
      style={brandStyle}
      className={`app ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget instanceof Node ? e.relatedTarget : null))
          setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) void open(file);
      }}
    >
      {ledger && data && (
        <header className="topbar" aria-label={branding.organization}>
          <div className="brand">
            {branding.logo && (
              <img className="brand-logo" src={branding.logo} alt={`${branding.organization} logo`} />
            )}
            <div className="brand-text">
              <span className="brand-name">{branding.organization}</span>
              <span className="brand-event" title={data.event.name}>
                {data.event.name}
              </span>
            </div>
          </div>
          <nav className="nav" aria-label="Näkymä">
            {VIEWS.map(({ id, label }) => (
              <button
                type="button"
                key={id}
                className="nav-item"
                aria-current={view === id ? "page" : undefined}
                disabled={busy}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="session">
            {operator && (
              <button
                type="button"
                className="btn btn-ghost operator"
                aria-label={`Vuorossa ${operator}, vaihda`}
                disabled={busy}
                onClick={() => setModal({ kind: "operator" })}
              >
                <span className="operator-caption">Vuorossa</span>
                <span className="operator-name">{operator}</span>
              </button>
            )}
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={logout}>
              Kirjaudu ulos
            </button>
          </div>
        </header>
      )}
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
      ) : !data ? null : view === "stats" ? (
        <Suspense fallback={null}>
          <EventStats ledger={ledger} revision={active.kind === "active" ? active.revision : 0} />
        </Suspense>
      ) : view === "settings" ? (
        <Settings
          snapshot={data}
          busy={busy}
          saveBranding={(value) => mutation.mutateAsync(() => ledger.saveBranding(value))}
          saveProduct={(value) => mutation.mutateAsync(() => ledger.saveProduct(value))}
          removeProduct={(id) => mutation.mutateAsync(() => ledger.removeProduct(id))}
          restoreCustomer={restoreCustomer}
          files={
            <>
              <FileControls
                busy={busy}
                encrypted={!!protection?.encrypted()}
                onOpen={() => void chooseDatabase()}
                onBackup={() => void download()}
              />
              {error && !modal && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
            </>
          }
        />
      ) : (
        <main className="workspace">
          <PeopleList
            customers={data.customers}
            selected={selected}
            disabled={busy}
            select={choose}
            add={(name) => {
              setError("");
              setModal({ kind: "customer", name });
            }}
          />
          <AccountPanel
            key={active.kind === "active" ? active.revision : 0}
            selectionRevision={selectionRevision}
            customer={customer}
            entries={entries}
            products={data.products}
            busy={busy}
            error={modal ? "" : error}
            setError={setError}
            onPost={async (input) => {
              let entryId = "";
              await mutation.mutateAsync(async () => {
                entryId = await ledger.post({ ...input, operator });
              });
              setNotice({
                kind: "entry",
                entryId,
                customerName: customer?.name ?? "",
                cents: input.kind === "charge" ? -input.cents : input.cents,
                label: input.label,
              });
            }}
            onEdit={() => {
              if (customer) setModal({ kind: "edit-customer", customer });
            }}
            onReverse={openReversal}
          />
        </main>
      )}
      {shownNotice && view === "cashier" && (
        <Toast
          busy={busy}
          action={shownNotice.kind === "entry" ? "Peru" : shownNotice.action}
          dismiss={() => setNotice(undefined)}
          onAction={() => {
            if (shownNotice.kind === "undo")
              void shownNotice.run().then(() => setNotice(undefined), () => {});
            else if (noticeEntry) openReversal(noticeEntry);
          }}
        >
          {shownNotice.kind === "entry" ? (
            <>
              <strong className={shownNotice.cents > 0 ? "positive" : "negative"}>
                {signedAmount(shownNotice.cents)}
              </strong>{" "}
              {noticeEntry ? entryTitle(noticeEntry) : ""} · {shownNotice.customerName}
            </>
          ) : (
            shownNotice.message
          )}
        </Toast>
      )}
      <Dialog.Root
        lazyMount
        unmountOnExit
        open={!!modal}
        onOpenChange={(event) => {
          if (event.open || mustChooseOperator) return;
          closeModal();
        }}
        placement="center"
      >
        <Portal>
          <Dialog.Backdrop className="dialog-backdrop" />
          <Dialog.Positioner>
            <Dialog.Content
              className={`modal ${modal?.kind === "onboarding" ? "modal-wide" : ""}`}
              style={brandStyle}
              aria-label={modal ? MODAL_TITLES[modal.kind] : undefined}
            >
              <Dialog.Body className="modal-body">
                {modal && <Dialog.Title className="modal-title">{MODAL_TITLES[modal.kind]}</Dialog.Title>}
                {modal?.kind === "operator" && (
                  <OperatorPrompt
                    current={operator}
                    recent={ledger?.operators() ?? []}
                    cancel={mustChooseOperator ? undefined : closeModal}
                    choose={(name) => {
                      setOperator(name);
                      setModal(undefined);
                    }}
                  />
                )}
                {(modal?.kind === "event" || modal?.kind === "create-event") && (
                  <EventChoice
                    previousName={modal.kind === "event" ? modal.next.ledger.latestEvent().name : undefined}
                    busy={busy}
                    cancel={closeModal}
                    onContinue={() => {
                      if (modal.kind === "event") finishOpening(modal.next);
                    }}
                    onCreate={createEvent}
                  />
                )}
                {modal?.kind === "onboarding" && (
                  <BrandingForm
                    initial={{ ...defaultBranding, organization: "" }}
                    busy={busy}
                    submitLabel="Jatka"
                    actions={(submit) => (
                      <DialogActions onCancel={closeModal} busy={busy}>
                        {submit}
                      </DialogActions>
                    )}
                    save={async (value) => {
                      setError("");
                      setModal({ kind: "create-event", branding: value });
                    }}
                  />
                )}
                {modal?.kind === "customer" && (
                  <CustomerForm
                    busy={busy}
                    withOpening
                    initial={{ name: modal.name, osakunta: "", note: "" }}
                    osakunnat={osakunnat}
                    people={people}
                    cancel={closeModal}
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
                )}
                {modal?.kind === "edit-customer" && (
                  <EditCustomer
                    customer={modal.customer}
                    busy={busy}
                    osakunnat={osakunnat}
                    people={people}
                    cancel={closeModal}
                    save={(values) => editCustomer(modal.customer, values)}
                    remove={() => removeCustomer(modal.customer)}
                  />
                )}
                {modal?.kind === "reverse" && (
                  <ReversalConfirmation
                    entry={modal.entry}
                    customerName={modal.customerName}
                    busy={busy}
                    cancel={closeModal}
                    confirm={async () => {
                      await mutation.mutateAsync(() => ledger?.reverse(modal.entry.id, operator));
                      setModal(undefined);
                    }}
                  />
                )}
                {error && modal && (
                  <p role="alert" className="error">
                    {error}
                  </p>
                )}
              </Dialog.Body>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </div>
  );
}