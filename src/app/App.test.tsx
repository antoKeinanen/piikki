// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { Ledger } from "../ledger";
import { createExample } from "../test-support/example-ledger";
import * as fileAccess from "../persistence/database-file";

vi.mock("sql.js/dist/sql-wasm.wasm?url", () => ({
  default: `${process.cwd()}/node_modules/sql.js/dist/sql-wasm.wasm`,
}));
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
function mount() {
  return render(
    <ChakraProvider value={defaultSystem}>
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <App />
      </QueryClientProvider>
    </ChakraProvider>,
  );
}
async function continueEvent() {
  fireEvent.click(await screen.findByRole("button", { name: /^Jatka tapahtumaa / }));
  await waitFor(() => expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull());
}
it("charges immediately, hides IDs and filenames, and opens branding settings", async () => {
  const ledger = await createExample();
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase").mockResolvedValue({
    ledger,
    name: "example.sqlite",
  });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Avaa tietokanta" }));
  await continueEvent();
  const balance = await screen.findByLabelText("Saldo");
  expect(balance.textContent).toBe("42,50");
  expect(screen.queryByText("1001")).toBeNull();
  expect(screen.queryByText("example.sqlite")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Veloita Lounas 8,50" }));
  await waitFor(() => expect(balance.textContent).toBe("34,00"));
  expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Lisää saldoa" }));
  fireEvent.change(screen.getByLabelText("Summa"), {
    target: { value: "10.00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Lisää saldoa 10,00" }));
  await waitFor(() => expect(balance.textContent).toBe("44,00"));
  expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Asetukset" }));
  expect(await screen.findByRole("dialog", { name: "Asetukset" })).toBeTruthy();
  expect(screen.getByLabelText("Pääväri")).toBeTruthy();
  expect(screen.getByLabelText("Taustaväri")).toBeTruthy();
  const logo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  fireEvent.change(screen.getByLabelText("Logo"), {
    target: {
      files: [
        new File(
          [Uint8Array.from(atob(logo.split(",")[1]), (c) => c.charCodeAt(0))],
          "logo.png",
          { type: "image/png" },
        ),
      ],
    },
  });
  await screen.findByAltText("Logon esikatselu");
  fireEvent.change(screen.getByLabelText("Osakunta"), {
    target: { value: "Testiosakunta" },
  });
  fireEvent.change(screen.getByLabelText("Pääväri"), {
    target: { value: "#102030" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tallenna" }));
  await waitFor(() =>
    expect(document.querySelector(".app")?.getAttribute("style")).toContain(
      "#102030",
    ),
  );
  fireEvent.click(screen.getByRole("tab", { name: "Tuotteet" }));
  expect(await screen.findByLabelText("Tuotteen hinta")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Tuotteen nimi"), { target: { value: "Kaakao" } });
  fireEvent.change(screen.getByLabelText("Tuotteen hinta"), {
    target: { value: "4.25" },
  });
  fireEvent.change(screen.getByLabelText("Kuvaus"), { target: { value: "Lämmin juoma" } });
  fireEvent.change(screen.getByLabelText("Tuotteen kuva"), {
    target: { files: [new File(["image"], "product.png", { type: "image/png" })] },
  });
  await screen.findByAltText("Tuotekuvan esikatselu");
  fireEvent.click(screen.getByRole("button", { name: "Lisää tuote" }));
  await screen.findByText("4,25");
  const preset = ledger.snapshot().products.find((value) => value.cents === 425);
  if (!preset) throw new Error("Preset was not saved");
  const row = screen.getByText("4,25").closest(".product-row");
  if (!(row instanceof HTMLElement)) throw new Error("Preset row missing");
  fireEvent.click(within(row).getByRole("button", { name: "Muokkaa" }));
  fireEvent.change(screen.getByLabelText("Tuotteen hinta"), { target: { value: "4.50" } });
  fireEvent.click(screen.getByRole("button", { name: "Tallenna tuote" }));
  await waitFor(() => expect(ledger.snapshot().products.find((p) => p.id === preset.id)?.cents).toBe(450));
  preset.cents = 450;
  fireEvent.click(within(row).getByRole("button", { name: "Poista" }));
  const restore = await screen.findByRole("button", { name: "Palauta Kaakao" });
  expect(
    ledger.snapshot().products.some((value) => value.id === preset.id),
  ).toBe(false);
  fireEvent.click(restore);
  await waitFor(() =>
    expect(
      ledger.snapshot().products.find((value) => value.id === preset.id),
    ).toEqual(preset),
  );
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Palauta Kaakao" })).toBeNull(),
  );

  fireEvent.click(screen.getByRole("button", { name: "Valmis" }));
  await waitFor(() =>
    expect(
      document.querySelector('[role="dialog"][data-state="open"]'),
    ).toBeNull(),
  );
  expect(screen.getByRole("banner", { name: "Testiosakunta" })).toBeTruthy();
  expect(screen.getByAltText("Testiosakunta logo").getAttribute("src")).toBe(
    logo,
  );
  fireEvent.click(screen.getByRole("button", { name: "Veloita" }));
  expect(
    await screen.findByRole("button", { name: "Veloita Kaakao 4,50" }),
  ).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Hae tuotetta"), { target: { value: "LÄMMIN" } });
  expect(screen.queryByRole("button", { name: "Veloita Lounas 8,50" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Veloita Kaakao 4,50" }));
  await waitFor(() => expect(screen.getByLabelText("Saldo").textContent).toBe("39,50"));
  expect(ledger.snapshot().entries[0].label).toBe("Kaakao");
  const reopened = await Ledger.open(ledger.export());
  expect(reopened.snapshot().products.find((p) => p.id === preset.id)).toEqual(preset);
});

it("blocks the app when required file access is missing, regardless of browser name", () => {
  mount();
  expect(
    screen.getByRole("region", { name: "Selaimen yhteensopivuus" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Avaa tietokanta" })).toBeNull();
  expect(screen.queryByLabelText("Hae henkilöä")).toBeNull();
  expect(localStorage.length).toBe(0);
});

it("offers a copyable link when the browser cannot open files", async () => {
  vi.stubGlobal("isSecureContext", true);
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  try {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Kopioi linkki" }));
    await screen.findByRole("button", { name: "Linkki kopioitu" });
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(
      screen.queryByRole("button", { name: "Avaa tietokanta" }),
    ).toBeNull();
  } finally {
    vi.unstubAllGlobals();
  }
});

it("collects organization branding before creating and saving the database", async () => {
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  const save = vi
    .spyOn(fileAccess, "saveDatabase")
    .mockImplementation(async (ledger, name) => ({
      ledger: await Ledger.open(ledger.export()),
      name,
    }));
  mount();
  expect(screen.queryByText("KyO")).toBeNull();
  expect(screen.getByRole("banner", { name: "Piikki" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Luo tietokanta" }));
  const dialog = await screen.findByRole("dialog", {
    name: "Organisaation tiedot",
  });
  expect(save).not.toHaveBeenCalled();
  const create = within(dialog).getByRole("button", { name: "Luo tietokanta" });
  expect(create.hasAttribute("disabled")).toBe(true);
  fireEvent.change(within(dialog).getByLabelText("Osakunta"), {
    target: { value: "Uusi organisaatio" },
  });
  fireEvent.change(within(dialog).getByLabelText("Pääväri"), {
    target: { value: "#123456" },
  });
  fireEvent.change(within(dialog).getByLabelText("Taustaväri"), {
    target: { value: "#abcdef" },
  });
  fireEvent.change(within(dialog).getByLabelText("Logo"), {
    target: {
      files: [new File(["logo"], "logo.svg", { type: "image/svg+xml" })],
    },
  });
  await screen.findByAltText("Logon esikatselu");
  fireEvent.click(create);
  await screen.findByRole("dialog", { name: "Valitse tapahtuma" });
  expect(save).not.toHaveBeenCalled();
  const createEvent = screen.getByRole("button", { name: "Luo uusi tapahtuma" });
  expect(createEvent.hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("Tapahtuman nimi"), { target: { value: "Avajaiset" } });
  fireEvent.click(createEvent);
  await screen.findByRole("banner", { name: "Uusi organisaatio" });
  expect(save).toHaveBeenCalledTimes(1);
  const saved = await Ledger.open(save.mock.calls[0][0].export());
  expect(saved.snapshot().event.name).toBe("Avajaiset");
  expect(saved.snapshot().branding).toEqual({
    organization: "Uusi organisaatio",
    primary: "#123456",
    secondary: "#abcdef",
    logo: "data:image/svg+xml;base64,bG9nbw==",
  });
});

it("cancels onboarding without creating a database", async () => {
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  const save = vi.spyOn(fileAccess, "saveDatabase");
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Luo tietokanta" }));
  await screen.findByRole("dialog", { name: "Organisaation tiedot" });
  fireEvent.click(screen.getByRole("button", { name: "Peruuta" }));
  await waitFor(() =>
    expect(
      document.querySelector('[role="dialog"][data-state="open"]'),
    ).toBeNull(),
  );
  expect(save).not.toHaveBeenCalled();
});

it("replaces the session snapshot and clears the cashier draft when opening another database", async () => {
  const first = await createExample();
  const second = await Ledger.open();
  await second.addCustomer("Second customer", "");
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase")
    .mockResolvedValueOnce({ ledger: first, name: "first.sqlite" })
    .mockResolvedValueOnce({ ledger: second, name: "second.sqlite" });
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Avaa tietokanta" }),
  );
  await continueEvent();
  await screen.findByLabelText("Saldo");
  fireEvent.click(screen.getByRole("button", { name: "Lisää saldoa" }));
  fireEvent.change(screen.getByLabelText("Summa"), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "Asetukset" }));
  fireEvent.click(await screen.findByRole("tab", { name: "Tietokanta" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Avaa tietokanta" }),
  );
  await continueEvent();
  await screen.findByRole("button", { name: "Second customer" });
  await waitFor(() =>
    expect(screen.getByLabelText("Saldo").textContent).toBe("0,00"),
  );
  expect(screen.queryByRole("button", { name: "Aino Korhonen" })).toBeNull();
  expect(screen.getByLabelText("Summa").getAttribute("value")).toBe("");
  expect(
    screen
      .getByRole("button", { name: "Veloita", pressed: true })
      .getAttribute("aria-pressed"),
  ).toBe("true");
});

it("keeps the amount and balance after a failed save, then allows retry", async () => {
  let fail = true;
  const example = await createExample();
  const ledger = await Ledger.open(example.export(), async () => {
    if (fail) throw new Error("Disk write failed");
  });
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase").mockResolvedValue({
    ledger,
    name: "test.sqlite",
  });
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Avaa tietokanta" }),
  );
  await continueEvent();
  await screen.findByLabelText("Saldo");
  fireEvent.change(screen.getByLabelText("Summa"), {
    target: { value: "50.00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Veloita 50,00" }));
  await screen.findByText("Disk write failed");
  expect(screen.getByLabelText("Saldo").textContent).toBe("42,50");
  expect(screen.getByLabelText("Summa").getAttribute("value")).toBe("50.00");
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "Veloita 50,00" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Saldo").textContent).toBe("−7,50"),
  );
  await waitFor(() =>
    expect(screen.getByLabelText("Summa").getAttribute("value")).toBe(""),
  );
});

it("charges below zero with custom amounts and products and reopens the saved account", async () => {
  const original = await createExample();
  let saved = original.export();
  const ledger = await Ledger.open(saved, async (bytes) => {
    saved = new Uint8Array(bytes);
  });
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  const pick = vi.spyOn(fileAccess, "pickDatabase").mockResolvedValue({
    ledger,
    name: "test.sqlite",
  });
  const app = mount();
  fireEvent.click(screen.getByRole("button", { name: "Avaa tietokanta" }));
  await continueEvent();
  await screen.findByLabelText("Saldo");
  fireEvent.change(screen.getByLabelText("Summa"), { target: { value: "50" } });
  fireEvent.click(screen.getByRole("button", { name: "Veloita 50,00" }));
  await waitFor(() => expect(screen.getByLabelText("Saldo").textContent).toBe("−7,50"));
  const quick = screen.getByRole("button", { name: "Veloita Lounas 8,50" });
  expect(quick.hasAttribute("disabled")).toBe(false);
  fireEvent.click(quick);
  await waitFor(() => expect(screen.getByLabelText("Saldo").textContent).toBe("−16,00"));
  fireEvent.click(screen.getAllByRole("button", { name: "Peru" })[0]);
  fireEvent.click(await screen.findByRole("button", { name: "Peru tapahtuma" }));
  await waitFor(() => expect(screen.getByLabelText("Saldo").textContent).toBe("−7,50"));
  app.unmount();
  pick.mockResolvedValue({ ledger: await Ledger.open(saved), name: "test.sqlite" });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Avaa tietokanta" }));
  await continueEvent();
  expect((await screen.findByLabelText("Saldo")).textContent).toBe("−7,50");
});

it("preserves the active database when opening a replacement is cancelled", async () => {
  const ledger = await createExample();
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase")
    .mockResolvedValueOnce({ ledger, name: "test.sqlite" })
    .mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"));
  mount();
  fireEvent.click(
    await screen.findByRole("button", { name: "Avaa tietokanta" }),
  );
  await continueEvent();
  await screen.findByLabelText("Saldo");
  fireEvent.click(screen.getByRole("button", { name: "Asetukset" }));
  fireEvent.click(await screen.findByRole("tab", { name: "Tietokanta" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Avaa tietokanta" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Valmis" }).hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Valmis" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Saldo").textContent).toBe("42,50"),
  );
  expect(ledger.snapshot().customers[0].balance).toBe(4250);
});

it("shows the previous event name and creates a named event that keeps the previous balances", async () => {
  const ledger = await createExample();
  const previous = ledger.snapshot();
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase").mockResolvedValue({ ledger, name: "test.sqlite" });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Avaa tietokanta" }));
  const dialog = await screen.findByRole("dialog", { name: "Valitse tapahtuma" });
  expect(within(dialog).getByText(`Edellinen tapahtuma: ${previous.event.name}`)).toBeTruthy();
  expect(screen.queryByLabelText("Saldo")).toBeNull();
  const create = within(dialog).getByRole("button", { name: "Luo uusi tapahtuma" });
  fireEvent.change(screen.getByLabelText("Tapahtuman nimi"), { target: { value: "   " } });
  expect(create.hasAttribute("disabled")).toBe(true);
  fireEvent.change(screen.getByLabelText("Tapahtuman nimi"), { target: { value: "  Talvijuhla  " } });
  fireEvent.click(create);
  await waitFor(() => expect(screen.getByLabelText("Saldo").textContent).toBe("42,50"));
  expect(screen.getByText("Talvijuhla")).toBeTruthy();
  expect(ledger.snapshot(previous.event.id)).toEqual(previous);
  expect((await Ledger.open(ledger.export())).latestEvent().name).toBe("Talvijuhla");
});

it("keeps the choice and previous event after a failed event save and allows retry", async () => {
  const original = await createExample();
  let fail = true;
  const ledger = await Ledger.open(original.export(), async () => {
    if (fail) throw new Error("Event save failed");
  });
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase").mockResolvedValue({ ledger, name: "test.sqlite" });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Avaa tietokanta" }));
  await screen.findByRole("dialog", { name: "Valitse tapahtuma" });
  fireEvent.change(screen.getByLabelText("Tapahtuman nimi"), { target: { value: "Talvijuhla" } });
  fireEvent.click(screen.getByRole("button", { name: "Luo uusi tapahtuma" }));
  await screen.findByText("Event save failed");
  expect(ledger.snapshot()).toEqual(original.snapshot());
  expect(screen.getByLabelText("Tapahtuman nimi").getAttribute("value")).toBe("Talvijuhla");
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "Luo uusi tapahtuma" }));
  await waitFor(() => expect(screen.getByLabelText("Saldo").textContent).toBe("42,50"));
});

it("cancels the event choice without activating or changing the selected file", async () => {
  const ledger = await createExample();
  const before = ledger.export();
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase").mockResolvedValue({ ledger, name: "test.sqlite" });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Avaa tietokanta" }));
  await screen.findByRole("dialog", { name: "Valitse tapahtuma" });
  fireEvent.click(screen.getByRole("button", { name: "Peruuta" }));
  await waitFor(() => expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull());
  expect(screen.queryByLabelText("Saldo")).toBeNull();
  expect(ledger.export()).toEqual(before);
});

it("keeps the current cashier session when the replacement event choice is cancelled", async () => {
  const first = await createExample();
  const second = await Ledger.create({ name: "Toinen juhla" });
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase")
    .mockResolvedValueOnce({ ledger: first, name: "first.sqlite" })
    .mockResolvedValueOnce({ ledger: second, name: "second.sqlite" });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Avaa tietokanta" }));
  await continueEvent();
  await screen.findByLabelText("Saldo");
  fireEvent.click(screen.getByRole("button", { name: "Asetukset" }));
  fireEvent.click(await screen.findByRole("tab", { name: "Tietokanta" }));
  fireEvent.click(await screen.findByRole("button", { name: "Avaa tietokanta" }));
  await screen.findByRole("button", { name: "Jatka tapahtumaa Toinen juhla" });
  fireEvent.click(screen.getByRole("button", { name: "Peruuta" }));
  await waitFor(() => expect(document.querySelector('[role="dialog"][data-state="open"]')).toBeNull());
  expect(screen.getByLabelText("Saldo").textContent).toBe("42,50");
  expect(screen.getByRole("button", { name: "Aino Korhonen" })).toBeTruthy();
  expect(first.snapshot().customers[0].balance).toBe(4250);
});

it("asks for the event after a dropped database has been connected to a saved copy", async () => {
  const ledger = await createExample();
  const bytes = ledger.export();
  const file = new File([new Uint8Array(bytes)], "dropped.sqlite");
  Object.defineProperty(file, "arrayBuffer", { value: async () => new Uint8Array(bytes).buffer });
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  const save = vi.spyOn(fileAccess, "saveDatabase").mockImplementation(async (imported, name) => ({ ledger: imported, name }));
  const mounted = mount();
  const app = mounted.container.querySelector(".app");
  if (!app) throw new Error("App missing");
  fireEvent.drop(app, { dataTransfer: { files: [file] } });
  await screen.findByRole("dialog", { name: "Valitse tapahtuma" });
  expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][1]).toBe("dropped.sqlite");
  expect(screen.queryByLabelText("Saldo")).toBeNull();
  await continueEvent();
  await waitFor(() => expect(screen.getByLabelText("Saldo").textContent).toBe("42,50"));
});

it("creates customer metadata and saves, updates, and clears a note across database reopen", async () => {
  let saved: Uint8Array | undefined;
  const ledger = await Ledger.open(undefined, async (bytes) => {
    saved = new Uint8Array(bytes);
  });
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase").mockImplementation(async () => ({
    ledger: saved ? await Ledger.open(saved) : ledger,
    name: "metadata.sqlite",
  }));
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Avaa tietokanta" }));
  await continueEvent();
  fireEvent.click(await screen.findByRole("button", { name: "Lisää henkilö" }));
  const dialog = await screen.findByRole("dialog", { name: "Lisää henkilö" });
  fireEvent.change(within(dialog).getByLabelText("Nimi"), { target: { value: "Aino" } });
  const osakunta = within(dialog).getByLabelText("Osakunta (valinnainen)");
  expect(osakunta.getAttribute("maxlength")).toBe("5");
  fireEvent.change(osakunta, { target: { value: "ABCDEF" } });
  expect(within(dialog).getByRole("button", { name: "Lisää henkilö" }).hasAttribute("disabled")).toBe(true);
  fireEvent.change(osakunta, { target: { value: "ABCDE" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Lisää henkilö" }));
  const note = await screen.findByLabelText("Muistiinpano");
  expect(screen.getByRole("cell", { name: "ABCDE" })).toBeTruthy();
  expect(within(screen.getByRole("region", { name: "Valittu henkilö" })).getByText("Aino • ABCDE")).toBeTruthy();
  expect(note.textContent).toBe("");
  for (const value of ["First\nSecond", "Updated", ""]) {
    fireEvent.change(note, { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Tallenna muistiinpano" }));
    await waitFor(() => expect(ledger.snapshot().customers[0].note).toBe(value));
    expect((await Ledger.open(saved)).snapshot().customers[0].note).toBe(value);
    await waitFor(() => expect(screen.getByRole("button", { name: "Tallenna muistiinpano" }).hasAttribute("disabled")).toBe(true));
  }
});

it("keeps a product draft after a failed save and retries without duplicates", async () => {
  let fail = true;
  const ledger = await Ledger.open(undefined, async () => { if (fail) throw new Error("Product write failed"); });
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase").mockResolvedValue({ ledger, name: "products.sqlite" });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Avaa tietokanta" }));
  await continueEvent();
  fireEvent.click(await screen.findByRole("button", { name: "Asetukset" }));
  fireEvent.click(await screen.findByRole("tab", { name: "Tuotteet" }));
  fireEvent.change(await screen.findByLabelText("Tuotteen nimi"), { target: { value: "Coffee" } });
  fireEvent.change(screen.getByLabelText("Tuotteen hinta"), { target: { value: "2.50" } });
  fireEvent.click(screen.getByRole("button", { name: "Lisää tuote" }));
  await screen.findAllByText("Product write failed");
  expect(ledger.snapshot().products).toEqual([]);
  expect(screen.getByLabelText("Tuotteen nimi").getAttribute("value")).toBe("Coffee");
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "Lisää tuote" }));
  await waitFor(() => expect(ledger.snapshot().products).toHaveLength(1));
  await waitFor(() => expect(screen.getByLabelText("Tuotteen nimi").getAttribute("value")).toBe(""));
});
it("shows statistics per event and switches back to the cashier", async () => {
  const ledger = await createExample();
  const aino = ledger.snapshot().customers.find((c) => c.reference === "1001");
  if (!aino) throw new Error("Example customer missing");
  const post = (label: string, cents: number) =>
    ledger.post({ customerId: aino.id, cents, label, kind: "charge" });
  await post("Lounas", 850);
  await post("Lounas", 850);
  await post("Kahvi", 250);
  const undone = ledger.snapshot().entries.find((e) => e.label === "Kahvi");
  if (!undone) throw new Error("Charge missing");
  await ledger.reverse(undone.id);
  await ledger.startEvent("Uusi juhla");
  vi.spyOn(fileAccess, "fileAccessProblem").mockReturnValue(undefined);
  vi.spyOn(fileAccess, "supportsDirectFiles").mockReturnValue(true);
  vi.spyOn(fileAccess, "pickDatabase").mockResolvedValue({
    ledger,
    name: "example.sqlite",
  });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Avaa tietokanta" }));
  await continueEvent();
  await screen.findByLabelText("Saldo");
  fireEvent.click(screen.getByRole("button", { name: "Tilastot" }));
  const tiles = () =>
    Object.fromEntries(
      [...document.querySelectorAll(".stat-tile")].map((tile) => [
        tile.querySelector(".stat-label")?.textContent,
        tile.querySelector(".stat-value")?.textContent,
      ]),
    );
  const comparison = () =>
    [...document.querySelectorAll(".chart-table-plain tbody tr")].map((row) => [
      row.querySelector("th")?.textContent,
      row.getAttribute("aria-current"),
    ]);
  await screen.findByText("Tässä tapahtumassa ei ole vielä myyntiä.");
  expect(tiles()).toMatchObject({ Myynti: "0,00", Ostoja: "0", Ostajia: "0", Velkaa: "0,00" });
  expect(screen.queryByRole("heading", { name: "Tuotteet" })).toBeNull();
  expect(comparison()).toEqual([
    ["Uusi juhla", "true"],
    ["Ensimmäinen tapahtuma", null],
  ]);
  const select = screen.getByLabelText("Tapahtuma");
  expect([...select.querySelectorAll("option")].map((o) => o.textContent)).toEqual([
    "Uusi juhla",
    "Ensimmäinen tapahtuma",
  ]);
  fireEvent.change(select, {
    target: { value: ledger.events()[0].id },
  });
  await screen.findByRole("heading", { name: "Tuotteet" });
  expect(tiles()).toEqual({
    Myynti: "17,00",
    Ostoja: "2",
    Keskiosto: "8,50",
    Ostajia: "1",
    "Saldoa lisätty": "231,50",
    "Saldoa jäljellä": "214,50",
    Velkaa: "0,00",
    "Perutut ostot": "1",
  });
  expect(comparison()[1]).toEqual(["Ensimmäinen tapahtuma", "true"]);
  const products = screen.getByLabelText("Myynti tuotteittain").textContent;
  expect(products).toContain("Lounas");
  expect(products).toContain("2 kpl");
  expect(products).not.toContain("Kahvi");
  expect(screen.getByLabelText("Eniten ostaneet henkilöt").textContent).toContain("Aino Korhonen");
  expect(screen.getByText("Näytä taulukkona")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Kassa" }));
  expect(await screen.findByLabelText("Saldo")).toBeTruthy();
  expect(document.querySelector(".stats")).toBeNull();
});
